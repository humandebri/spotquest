import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Int "mo:base/Int";

module {
    // ======================================
    // TYPES
    // ======================================
    public type SessionStatus = {
        #Open;
        #HasDelegation;
        #Closed;
    };
    
    public type SessionData = {
        sessionId: Text;
        principal: ?Principal;
        timestamp: Time.Time;
        state: Text;
        nonce: Text;
        redirectUri: Text;
        status: SessionStatus;
        publicKey: ?Text;
        delegation: ?Text;
        userPublicKey: ?Text;
        delegationPubkey: ?Text;
    };

    public type NewSessionRequest = {
        publicKey: Text;
        redirectUri: ?Text;
    };
    
    public type NewSessionResponse = {
        sessionId: Text;
        authorizeUrl: Text;
    };
    
    public type DelegateRequest = {
        delegation: Text;
        userPublicKey: Text;
        delegationPubkey: Text;
    };
    
    public type DelegateResponse = {
        success: Bool;
        error: ?Text;
    };

    public type AuthRequest = {
        sessionId: Text;
        state: Text;
        nonce: Text;
        redirectUri: Text;
        scopes: [Text];
    };

    public type AuthResponse = {
        sessionId: Text;
        authUrl: Text;
    };

    public type CompleteRequest = {
        sessionId: Text;
        principal: Principal;
        delegation: Blob;
    };

    public type CompleteResponse = {
        success: Bool;
        principal: ?Principal;
        error: ?Text;
    };

    // ======================================
    // II INTEGRATION MANAGER
    // ======================================
    public class IIIntegrationManager() {
        private var sessions = HashMap.HashMap<Text, SessionData>(10, Text.equal, Text.hash);
        private let SESSION_TIMEOUT : Int = 300_000_000_000; // 5 minutes in nanoseconds
        private var sessionCounter : Nat = 0;

        // Create new session (POST /api/session/new)
        public func newSession(publicKey: Text, canisterOrigin: Text, redirectUri: ?Text) : NewSessionResponse {
            sessionCounter += 1;
            let sessionId = Text.concat(
                Text.concat("session_", Nat.toText(sessionCounter)),
                Text.concat("_", Nat.toText(Int.abs(Time.now())))
            );
            
            // Use provided redirectUri or default
            let finalRedirectUri = switch(redirectUri) {
                case (?uri) { uri };
                case null { "https://auth.expo.io/@hude/spotquest" };
            };
            
            let sessionData : SessionData = {
                sessionId = sessionId;
                principal = null;
                timestamp = Time.now();
                state = sessionId; // Use sessionId as state
                nonce = sessionId; // Use sessionId as nonce
                redirectUri = finalRedirectUri;
                status = #Open;
                publicKey = ?publicKey;
                delegation = null;
                userPublicKey = null;
                delegationPubkey = null;
            };
            
            sessions.put(sessionId, sessionData);
            
            // Build authorize URL for II with proper URL encoding
            // Note: Motoko doesn't have built-in URL encoding, so we'll encode critical characters manually
            let encodedRedirectUri = Text.replace(
                Text.replace(sessionData.redirectUri, #char '@', "%40"),
                #char '/', "%2F"
            );
            
            let authorizeUrl = "https://identity.ic0.app/#authorize?" #
                "client_id=" # canisterOrigin # "&" #
                "redirect_uri=" # encodedRedirectUri # "&" #
                "state=" # sessionId # "&" #
                "response_type=token&" #
                "scope=openid&" #
                "nonce=" # sessionId;
            
            {
                sessionId = sessionId;
                authorizeUrl = authorizeUrl;
            }
        };
        
        // Save delegation (POST /api/session/:id/delegate)
        public func saveDelegate(sessionId: Text, delegation: Text, userPublicKey: Text, delegationPubkey: Text) : DelegateResponse {
            switch (sessions.get(sessionId)) {
                case null {
                    {
                        success = false;
                        error = ?"Session not found";
                    }
                };
                case (?session) {
                    let now = Time.now();
                    if (now - session.timestamp > SESSION_TIMEOUT) {
                        sessions.delete(sessionId);
                        {
                            success = false;
                            error = ?"Session expired";
                        }
                    } else if (session.status != #Open) {
                        {
                            success = false;
                            error = ?"Session not in Open state";
                        }
                    } else {
                        // Update session with delegation
                        let updatedSession : SessionData = {
                            sessionId = session.sessionId;
                            principal = session.principal;
                            timestamp = session.timestamp;
                            state = session.state;
                            nonce = session.nonce;
                            redirectUri = session.redirectUri;
                            status = #HasDelegation;
                            publicKey = session.publicKey;
                            delegation = ?delegation;
                            userPublicKey = ?userPublicKey;
                            delegationPubkey = ?delegationPubkey;
                        };
                        
                        sessions.put(sessionId, updatedSession);
                        
                        {
                            success = true;
                            error = null;
                        }
                    }
                };
            }
        };
        
        // Close session (POST /api/session/:id/close)
        public func closeSession(sessionId: Text) : Bool {
            switch (sessions.get(sessionId)) {
                case null { false };
                case (?session) {
                    if (session.status == #HasDelegation) {
                        // Update status to Closed
                        let updatedSession : SessionData = {
                            sessionId = session.sessionId;
                            principal = session.principal;
                            timestamp = session.timestamp;
                            state = session.state;
                            nonce = session.nonce;
                            redirectUri = session.redirectUri;
                            status = #Closed;
                            publicKey = session.publicKey;
                            delegation = session.delegation;
                            userPublicKey = session.userPublicKey;
                            delegationPubkey = session.delegationPubkey;
                        };
                        sessions.put(sessionId, updatedSession);
                        true
                    } else {
                        false
                    }
                };
            }
        };
        
        // Get delegation for closed session
        public func getDelegation(sessionId: Text) : ?{delegation: Text; userPublicKey: Text; delegationPubkey: Text} {
            switch (sessions.get(sessionId)) {
                case null { null };
                case (?session) {
                    if (session.status == #Closed) {
                        switch(session.delegation, session.userPublicKey, session.delegationPubkey) {
                            case (?d, ?u, ?p) {
                                ?{delegation = d; userPublicKey = u; delegationPubkey = p}
                            };
                            case _ { null };
                        }
                    } else {
                        null
                    }
                };
            }
        };
        
        // Initialize authentication (legacy method)
        public func initAuth(request: AuthRequest) : AuthResponse {
            let sessionData : SessionData = {
                sessionId = request.sessionId;
                principal = null;
                timestamp = Time.now();
                state = request.state;
                nonce = request.nonce;
                redirectUri = request.redirectUri;
                status = #Open;
                publicKey = null;
                delegation = null;
                userPublicKey = null;
                delegationPubkey = null;
            };
            
            sessions.put(request.sessionId, sessionData);
            
            // Build II auth URL
            let iiUrl = "https://identity.ic0.app";
            let authUrl = iiUrl # "/#authorize?sessionId=" # request.sessionId # 
                         "&state=" # request.state # 
                         "&redirectUri=" # request.redirectUri;
            
            {
                sessionId = request.sessionId;
                authUrl = authUrl;
            }
        };

        // Complete authentication
        public func completeAuth(request: CompleteRequest) : CompleteResponse {
            switch (sessions.get(request.sessionId)) {
                case null { 
                    {
                        success = false;
                        principal = null;
                        error = ?"Session not found";
                    }
                };
                case (?session) {
                    let now = Time.now();
                    if (now - session.timestamp > SESSION_TIMEOUT) {
                        sessions.delete(request.sessionId);
                        {
                            success = false;
                            principal = null;
                            error = ?"Session expired";
                        }
                    } else {
                        // Update session with principal
                        let updatedSession : SessionData = {
                            sessionId = session.sessionId;
                            principal = ?request.principal;
                            timestamp = session.timestamp;
                            state = session.state;
                            nonce = session.nonce;
                            redirectUri = session.redirectUri;
                            status = session.status;
                            publicKey = session.publicKey;
                            delegation = session.delegation;
                            userPublicKey = session.userPublicKey;
                            delegationPubkey = session.delegationPubkey;
                        };
                        
                        sessions.put(request.sessionId, updatedSession);
                        
                        {
                            success = true;
                            principal = ?request.principal;
                            error = null;
                        }
                    }
                };
            }
        };

        // Get all session IDs for debugging
        public func getAllSessionIds() : [Text] {
            let buffer = Buffer.Buffer<Text>(sessions.size());
            for ((id, _) in sessions.entries()) {
                buffer.add(id);
            };
            Buffer.toArray(buffer)
        };
        
        // Get session status
        public func getSessionStatus(sessionId: Text) : ?SessionData {
            sessions.get(sessionId)
        };

        // Clean up expired sessions
        public func cleanupExpiredSessions() : () {
            let now = Time.now();
            let toDelete = Buffer.Buffer<Text>(0);
            
            for ((id, session) in sessions.entries()) {
                if (now - session.timestamp > SESSION_TIMEOUT) {
                    toDelete.add(id);
                };
            };
            
            for (id in toDelete.vals()) {
                sessions.delete(id);
            };
        };

        // Prepare for upgrade
        public func preupgrade() : [(Text, SessionData)] {
            Iter.toArray(sessions.entries())
        };

        // Restore after upgrade
        public func postupgrade(entries: [(Text, SessionData)]) {
            sessions := HashMap.fromIter<Text, SessionData>(
                entries.vals(),
                entries.size(),
                Text.equal,
                Text.hash
            );
        };
    };
}