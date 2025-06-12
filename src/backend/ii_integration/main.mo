import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Result "mo:base/Result";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Blob "mo:base/Blob";
import Nat "mo:base/Nat";
import Int "mo:base/Int";

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
    
    // HTTP types
    type HttpRequest = {
        body: Blob;
        headers: [(Text, Text)];
        method: Text;
        url: Text;
    };
    
    type HttpResponse = {
        body: Blob;
        headers: [(Text, Text)];
        status_code: Nat16;
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
    
    // Helper function to create JSON response
    private func jsonResponse(json: Text, statusCode: Nat16) : HttpResponse {
        {
            body = Text.encodeUtf8(json);
            headers = [
                ("Content-Type", "application/json"),
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type")
            ];
            status_code = statusCode;
        }
    };
    
    // Get request body as text
    private func getBodyText(body: Blob) : Text {
        switch (Text.decodeUtf8(body)) {
            case null { "" };
            case (?text) { text };
        }
    };
    
    // HTTP request handler
    public query func http_request(req: HttpRequest) : async HttpResponse {
        // Parse URL path
        let fullPath = req.url;
        let path = switch (Text.split(fullPath, #char '?').next()) {
            case null { fullPath };
            case (?p) { p };
        };
        
        // Handle OPTIONS requests for CORS
        if (req.method == "OPTIONS") {
            return {
                body = Blob.fromArray([]);
                headers = [
                    ("Access-Control-Allow-Origin", "*"),
                    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                    ("Access-Control-Allow-Headers", "Content-Type")
                ];
                status_code = 204;
            };
        };
        
        // Handle GET / - Return status for expo-ii-integration
        if (req.method == "GET" and (path == "/" or path == "")) {
            return jsonResponse("{\"status\":\"ready\",\"canisterId\":\"77fv5-oiaaa-aaaal-qsoea-cai\",\"type\":\"ii_integration\"}", 200);
        };
        
        // Handle POST /api/session/new - Create new session
        if (req.method == "POST" and path == "/api/session/new") {
            let bodyText = getBodyText(req.body);
            
            // Simple parsing of publicKey from JSON body
            var publicKey = "";
            if (Text.contains(bodyText, #text "\"publicKey\"")) {
                let parts = Text.split(bodyText, #text "\"publicKey\"");
                switch (parts.next()) {
                    case null { };
                    case (?_) {
                        switch (parts.next()) {
                            case null { };
                            case (?part) {
                                let valueParts = Text.split(part, #text "\"");
                                switch (valueParts.next()) {
                                    case null { };
                                    case (?_) {
                                        switch (valueParts.next()) {
                                            case null { };
                                            case (?_) {
                                                switch (valueParts.next()) {
                                                    case null { };
                                                    case (?value) { publicKey := value; };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            
            if (publicKey == "") {
                return jsonResponse("{\"error\":\"Missing publicKey\"}", 400);
            };
            
            // Generate session ID
            let timestamp = Int.abs(Time.now());
            let sessionId = "session_" # publicKey # "_" # Int.toText(timestamp);
            
            // Create session
            let sessionData : SessionData = {
                principal = Principal.fromText("2vxsx-fae"); // Anonymous principal for now
                timestamp = Time.now();
                nonce = sessionId;
                status = #pending;
            };
            
            sessions.put(sessionId, sessionData);
            
            // Build authorize URL
            let canisterOrigin = "https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io";
            let authorizeUrl = "https://identity.ic0.app/#authorize?" #
                "client_id=" # canisterOrigin # "&" #
                "redirect_uri=" # canisterOrigin # "/callback&" #
                "state=" # sessionId # "&" #
                "response_type=id_token&" #
                "scope=openid&" #
                "nonce=" # sessionId;
            
            let json = "{\"sessionId\":\"" # sessionId # "\",\"authorizeUrl\":\"" # authorizeUrl # "\"}";
            return jsonResponse(json, 200);
        };
        
        // Default response
        jsonResponse("{\"error\":\"Not Found\",\"path\":\"" # path # "\"}", 404)
    };
    
    // HTTP request update handler (for certified responses)
    public func http_request_update(req: HttpRequest) : async HttpResponse {
        // For now, just delegate to http_request
        await http_request(req)
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