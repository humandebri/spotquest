import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat16 "mo:base/Nat16";
import Iter "mo:base/Iter";

module {
    public type HttpRequest = {
        url: Text;
        method: Text;
        body: Blob;
        headers: [(Text, Text)];
    };
    
    public type HttpResponse = {
        body: Blob;
        headers: [(Text, Text)];
        status_code: Nat16;
    };
    
    public type Asset = {
        content: Blob;
        content_type: Text;
        content_encoding: Text;
    };
    
    public class Assets() {
        private var assets = HashMap.HashMap<Text, Asset>(10, Text.equal, Text.hash);
        private stable var assetEntries : [(Text, Asset)] = [];
        
        // Default paths
        private let DEFAULT_PATH = "/index.html";
        
        public func store(path: Text, content: Blob, content_type: Text) {
            let asset: Asset = {
                content = content;
                content_type = content_type;
                content_encoding = "identity";
            };
            assets.put(path, asset);
        };
        
        public func get(path: Text) : ?Asset {
            assets.get(path);
        };
        
        public func delete(path: Text) : Bool {
            switch (assets.remove(path)) {
                case null { false };
                case (?_) { true };
            };
        };
        
        private func getAssetPath(url: Text) : Text {
            // Remove query parameters
            let path = switch (Text.split(url, #char '?').next()) {
                case null { url };
                case (?p) { p };
            };
            
            // Handle root path
            if (path == "/" or path == "") {
                DEFAULT_PATH;
            } else if (Text.startsWith(path, #text "/")) {
                path;
            } else {
                "/" # path;
            };
        };
        
        public func http_request(request: HttpRequest) : HttpResponse {
            let path = getAssetPath(request.url);
            
            switch (assets.get(path)) {
                case null {
                    // Try index.html for directory paths
                    let indexPath = if (Text.endsWith(path, #text "/")) {
                        path # "index.html";
                    } else {
                        path # "/index.html";
                    };
                    
                    switch (assets.get(indexPath)) {
                        case null {
                            // 404 Not Found
                            {
                                body = Text.encodeUtf8("404 Not Found");
                                headers = [
                                    ("Content-Type", "text/plain"),
                                    ("Content-Length", Int.toText(Text.encodeUtf8("404 Not Found").size()))
                                ];
                                status_code = 404;
                            };
                        };
                        case (?asset) {
                            serveAsset(asset);
                        };
                    };
                };
                case (?asset) {
                    serveAsset(asset);
                };
            };
        };
        
        public func http_request_update(request: HttpRequest) : HttpResponse {
            // For now, just delegate to query
            http_request(request);
        };
        
        private func serveAsset(asset: Asset) : HttpResponse {
            {
                body = asset.content;
                headers = [
                    ("Content-Type", asset.content_type),
                    ("Content-Encoding", asset.content_encoding),
                    ("Content-Length", Int.toText(asset.content.size())),
                    ("Cache-Control", "public, max-age=31536000"),
                    ("Access-Control-Allow-Origin", "*")
                ];
                status_code = 200;
            };
        };
        
        public func preupgrade() : [(Text, Asset)] {
            Iter.toArray(assets.entries());
        };
        
        public func postupgrade(entries: [(Text, Asset)]) {
            assets := HashMap.fromIter<Text, Asset>(entries.vals(), entries.size(), Text.equal, Text.hash);
        };
    };
}