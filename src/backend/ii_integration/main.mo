import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Result "mo:base/Result";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";

// II Integration Bridge Canister
// This canister acts as a bridge between the Expo app and Internet Identity
actor IIIntegration {
    // Store session data temporarily
    private var sessions = HashMap.HashMap<Text, SessionData>(10, Text.equal, Text.hash);
    private stable var sessionEntries : [(Text, SessionData)] = [];
    
    type SessionData = {
        principal: Principal;
        timestamp: Time.Time;
        nonce: Text;
        status: SessionStatus;
    };
    
    type SessionStatus = {
        #pending;
        #authenticated;
        #expired;
    };
    
    type AuthRequest = {
        sessionId: Text;
        nonce: Text;
        callbackUrl: Text;
    };
    
    type AuthResponse = {
        sessionId: Text;
        principal: ?Principal;
        status: SessionStatus;
        error: ?Text;
    };
    
    // Initialize an authentication session
    public shared(msg) func initAuth(request: AuthRequest) : async Result.Result<AuthResponse, Text> {
        let now = Time.now();
        
        // Create session data
        let sessionData : SessionData = {
            principal = msg.caller;
            timestamp = now;
            nonce = request.nonce;
            status = #pending;
        };
        
        // Store session
        sessions.put(request.sessionId, sessionData);
        
        #ok({
            sessionId = request.sessionId;
            principal = null;
            status = #pending;
            error = null;
        })
    };
    
    // Verify and complete authentication
    public shared(msg) func completeAuth(sessionId: Text, principal: Principal) : async Result.Result<AuthResponse, Text> {
        switch (sessions.get(sessionId)) {
            case null { 
                #err("Session not found") 
            };
            case (?session) {
                // Verify session is still valid (5 minutes timeout)
                let now = Time.now();
                if (now - session.timestamp > 300_000_000_000) { // 5 minutes in nanoseconds
                    sessions.delete(sessionId);
                    #err("Session expired")
                } else {
                    // Update session status
                    let updatedSession : SessionData = {
                        principal = principal;
                        timestamp = session.timestamp;
                        nonce = session.nonce;
                        status = #authenticated;
                    };
                    
                    sessions.put(sessionId, updatedSession);
                    
                    #ok({
                        sessionId = sessionId;
                        principal = ?principal;
                        status = #authenticated;
                        error = null;
                    })
                }
            };
        }
    };
    
    // Check authentication status
    public query func getAuthStatus(sessionId: Text) : async Result.Result<AuthResponse, Text> {
        switch (sessions.get(sessionId)) {
            case null { 
                #err("Session not found") 
            };
            case (?session) {
                #ok({
                    sessionId = sessionId;
                    principal = ?session.principal;
                    status = session.status;
                    error = null;
                })
            };
        }
    };
    
    // Clean up expired sessions
    public func cleanupSessions() : async () {
        let now = Time.now();
        let expiredSessions = Iter.filter<(Text, SessionData)>(
            sessions.entries(),
            func((id, session)) : Bool {
                now - session.timestamp > 300_000_000_000 // 5 minutes
            }
        );
        
        for ((id, _) in expiredSessions) {
            sessions.delete(id);
        };
    };
    
    // System functions
    system func preupgrade() {
        sessionEntries := Iter.toArray(sessions.entries());
    };
    
    system func postupgrade() {
        sessions := HashMap.fromIter<Text, SessionData>(
            sessionEntries.vals(),
            sessionEntries.size(),
            Text.equal,
            Text.hash
        );
        sessionEntries := [];
    };
};