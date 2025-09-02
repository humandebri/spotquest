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
import Nat8 "mo:base/Nat8";
import Nat32 "mo:base/Nat32";
import Int "mo:base/Int";
import Char "mo:base/Char";
import Array "mo:base/Array";

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

        // Hex digits for URL encoding
        private let HEX_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
        
        // URL encoding function following RFC 3986 with proper hex encoding
        private func utf8PercentEncode(t : Text) : Text {
            let bytes = Blob.toArray(Text.encodeUtf8(t));
            var result = "";
            
            for (b in bytes.vals()) {
                if ((b >= 0x41 and b <= 0x5A) or   // A-Z
                    (b >= 0x61 and b <= 0x7A) or   // a-z
                    (b >= 0x30 and b <= 0x39) or   // 0-9
                    b == 0x2D or b == 0x2E or      // - .
                    b == 0x5F or b == 0x7E) {      // _ ~
                    // Safe character - add as is
                    result := result # Char.toText(Char.fromNat32(Nat32.fromNat(Nat8.toNat(b))));
                } else {
                    // Encode as %XX where XX is hex
                    let hi = HEX_CHARS[Nat8.toNat(b / 16)];
                    let lo = HEX_CHARS[Nat8.toNat(b % 16)];
                    result := result # "%" # Char.toText(hi) # Char.toText(lo);
                }
            };
            
            result
        };

        // Create new session (POST /api/session/new)
        public func newSession(publicKey: Text, canisterOrigin: Text, nativeRedirectUri: Text) : NewSessionResponse {
            sessionCounter += 1;
            let sessionId = Text.concat(
                Text.concat("session_", Nat.toText(sessionCounter)),
                Text.concat("_", Nat.toText(Int.abs(Time.now())))
            );
            
            let sessionData : SessionData = {
                sessionId = sessionId;
                principal = null;
                timestamp = Time.now();
                state = sessionId; // Use sessionId as state
                nonce = sessionId; // Use sessionId as nonce
                redirectUri = nativeRedirectUri; // Store native redirect URI (e.g., spotquest:///)
                status = #Open;
                publicKey = ?publicKey;
                delegation = null;
                userPublicKey = null;
                delegationPubkey = null;
            };
            
            sessions.put(sessionId, sessionData);
            
            // Build authorize URL for II with simple callback URL (no query params)
            let callbackUrl = canisterOrigin # "/callback";
            let encodedCallbackUrl = utf8PercentEncode(callbackUrl);
            
            // Use path-based authorize endpoint (id.ai/authorize) to avoid SPA hash routing issues
            let authorizeUrl = "https://id.ai/authorize?" #
                "client_id=" # canisterOrigin # "&" #
                "redirect_uri=" # encodedCallbackUrl # "&" #
                "state=" # sessionId # "&" #
                // Request an ID Token (JWT) so callback can parse it
                "response_type=id_token&" #
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
            let iiUrl = "https://id.ai";
            // Use path-based authorize to ensure parameters persist across navigation
            let authUrl = iiUrl # "/authorize?sessionId=" # request.sessionId # 
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
