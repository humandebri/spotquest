import CertifiedData "mo:base/CertifiedData";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Nat8 "mo:base/Nat8";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Nat "mo:base/Nat";
import Nat16 "mo:base/Nat16";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";
import Option "mo:base/Option";
import Order "mo:base/Order";

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

    // Hash tree type for certification
    public type Hash = Blob;
    public type Key = Blob;
    public type Value = Blob;
    public type HashTree = {
        #empty;
        #pruned : Hash;
        #fork : (HashTree, HashTree);
        #labeled : (Key, HashTree);
        #leaf : Value;
    };

    // HTTP response representation for certification
    type StoredResponse = {
        body: Blob;
        headers: [(Text, Text)];
        status_code: Nat16;
    };

    public class AssetManager() {
        private var assets = HashMap.HashMap<Text, StoredResponse>(10, Text.equal, Text.hash);
        private var responseHashes = HashMap.HashMap<Text, Blob>(10, Text.equal, Text.hash);
        
        // SHA256 constants
        private let K : [Nat32] = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        
        // SHA256 implementation
        public func sha256(data: Blob) : Blob {
            let bytes = Blob.toArray(data);
            let msgLen = bytes.size();
            
            // Initialize hash values
            var H : [var Nat32] = [var
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
            ];
            
            // Preprocessing: adding padding
            let paddedMsg = Buffer.Buffer<Nat8>(msgLen + 64);
            for (b in bytes.vals()) {
                paddedMsg.add(b);
            };
            paddedMsg.add(0x80);
            
            while ((paddedMsg.size() + 8) % 64 != 0) {
                paddedMsg.add(0x00);
            };
            
            // Append message length in bits as 64-bit big-endian
            let msgBitLen : Nat64 = Nat64.fromNat(msgLen * 8);
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 56) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 48) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 40) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 32) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 24) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 16) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((msgBitLen >> 8) & 0xFF)));
            paddedMsg.add(Nat8.fromNat(Nat64.toNat(msgBitLen & 0xFF)));
            
            let paddedBytes = Buffer.toArray(paddedMsg);
            
            // Process the message in 512-bit chunks
            var chunk = 0;
            while (chunk < paddedBytes.size() / 64) {
                let W = Buffer.Buffer<Nat32>(64);
                
                // Copy chunk into first 16 words
                for (i in Iter.range(0, 15)) {
                    let offset = chunk * 64 + i * 4;
                    let w = (Nat32.fromNat(Nat8.toNat(paddedBytes[offset])) << 24) |
                            (Nat32.fromNat(Nat8.toNat(paddedBytes[offset + 1])) << 16) |
                            (Nat32.fromNat(Nat8.toNat(paddedBytes[offset + 2])) << 8) |
                            Nat32.fromNat(Nat8.toNat(paddedBytes[offset + 3]));
                    W.add(w);
                };
                
                // Extend the first 16 words into the remaining 48 words
                for (i in Iter.range(16, 63)) {
                    let s0 = ((W.get(i-15) >> 7) | (W.get(i-15) << 25)) ^ 
                             ((W.get(i-15) >> 18) | (W.get(i-15) << 14)) ^ 
                             (W.get(i-15) >> 3);
                    let s1 = ((W.get(i-2) >> 17) | (W.get(i-2) << 15)) ^ 
                             ((W.get(i-2) >> 19) | (W.get(i-2) << 13)) ^ 
                             (W.get(i-2) >> 10);
                    W.add(W.get(i-16) +% s0 +% W.get(i-7) +% s1);
                };
                
                // Initialize working variables
                var a = H[0];
                var b = H[1];
                var c = H[2];
                var d = H[3];
                var e = H[4];
                var f = H[5];
                var g = H[6];
                var h = H[7];
                
                // Main loop
                for (i in Iter.range(0, 63)) {
                    let S1 = ((e >> 6) | (e << 26)) ^ ((e >> 11) | (e << 21)) ^ ((e >> 25) | (e << 7));
                    let ch = (e & f) ^ ((^e) & g);
                    let temp1 = h +% S1 +% ch +% K[i] +% W.get(i);
                    let S0 = ((a >> 2) | (a << 30)) ^ ((a >> 13) | (a << 19)) ^ ((a >> 22) | (a << 10));
                    let maj = (a & b) ^ (a & c) ^ (b & c);
                    let temp2 = S0 +% maj;
                    
                    h := g;
                    g := f;
                    f := e;
                    e := d +% temp1;
                    d := c;
                    c := b;
                    b := a;
                    a := temp1 +% temp2;
                };
                
                // Add the compressed chunk to the current hash value
                H[0] := H[0] +% a;
                H[1] := H[1] +% b;
                H[2] := H[2] +% c;
                H[3] := H[3] +% d;
                H[4] := H[4] +% e;
                H[5] := H[5] +% f;
                H[6] := H[6] +% g;
                H[7] := H[7] +% h;
                
                chunk += 1;
            };
            
            // Produce the final hash value as a 32-byte Blob
            let result = Buffer.Buffer<Nat8>(32);
            for (i in Iter.range(0, 7)) {
                let h = H[i];
                result.add(Nat8.fromNat(Nat32.toNat((h >> 24) & 0xFF)));
                result.add(Nat8.fromNat(Nat32.toNat((h >> 16) & 0xFF)));
                result.add(Nat8.fromNat(Nat32.toNat((h >> 8) & 0xFF)));
                result.add(Nat8.fromNat(Nat32.toNat(h & 0xFF)));
            };
            
            Blob.fromArray(Buffer.toArray(result))
        };
        
        // Base64URL encoding
        private func base64UrlEncode(data: Blob) : Text {
            let base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
            let bytes = Blob.toArray(data);
            var result = "";
            var i = 0;
            
            while (i < bytes.size()) {
                let b1 = bytes[i];
                let b2 : Nat8 = if (i + 1 < bytes.size()) { bytes[i + 1] } else { 0 : Nat8 };
                let b3 : Nat8 = if (i + 2 < bytes.size()) { bytes[i + 2] } else { 0 : Nat8 };
                
                let n = (Nat32.fromNat(Nat8.toNat(b1)) << 16) | 
                        (Nat32.fromNat(Nat8.toNat(b2)) << 8) | 
                        Nat32.fromNat(Nat8.toNat(b3));
                
                result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 18) & 0x3F)]);
                result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 12) & 0x3F)]);
                
                // No padding for Base64URL
                if (i + 1 < bytes.size()) {
                    result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 6) & 0x3F)]);
                    if (i + 2 < bytes.size()) {
                        result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat(n & 0x3F)]);
                    };
                };
                
                i += 3;
            };
            
            result
        };
        
        // Calculate hash of tree
        private func hashOfTree(tree: HashTree) : Blob {
            switch (tree) {
                case (#empty) {
                    // Hash of domain separator "ic-hashtree-empty" with length prefix
                    let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                    let labelText = Text.encodeUtf8("ic-hashtree-empty");
                    let combined = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                    sha256(combined)
                };
                case (#pruned(hash)) {
                    hash // Already a hash
                };
                case (#fork(left, right)) {
                    let leftHash = hashOfTree(left);
                    let rightHash = hashOfTree(right);
                    // Hash of domain separator "ic-hashtree-fork" + left hash + right hash
                    let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                    let labelText = Text.encodeUtf8("ic-hashtree-fork");
                    let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                    let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + leftHash.size() + rightHash.size());
                    for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                    for (b in Blob.toArray(leftHash).vals()) { combined.add(b) };
                    for (b in Blob.toArray(rightHash).vals()) { combined.add(b) };
                    sha256(Blob.fromArray(Buffer.toArray(combined)))
                };
                case (#labeled(key, subtree)) {
                    let subtreeHash = hashOfTree(subtree);
                    // Hash of domain separator "ic-hashtree-labeled" + key + subtree hash
                    let prefixByte = Blob.fromArray([0x13]); // Length prefix: 19
                    let labelText = Text.encodeUtf8("ic-hashtree-labeled");
                    let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                    let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + key.size() + subtreeHash.size());
                    for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                    for (b in Blob.toArray(key).vals()) { combined.add(b) };
                    for (b in Blob.toArray(subtreeHash).vals()) { combined.add(b) };
                    sha256(Blob.fromArray(Buffer.toArray(combined)))
                };
                case (#leaf(value)) {
                    // Hash of domain separator "ic-hashtree-leaf" + value
                    let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                    let labelText = Text.encodeUtf8("ic-hashtree-leaf");
                    let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                    let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + value.size());
                    for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                    for (b in Blob.toArray(value).vals()) { combined.add(b) };
                    sha256(Blob.fromArray(Buffer.toArray(combined)))
                };
            }
        };
        
        // CBOR encoding helpers
        private func cborEncodeBytes(data: Blob) : Blob {
            let bytes = Blob.toArray(data);
            let size = bytes.size();
            
            if (size < 24) {
                // Major type 2 (byte string) with length in lower 5 bits
                Blob.fromArray(Array.append([0x40 + Nat8.fromNat(size)], bytes))
            } else if (size < 256) {
                // Major type 2 with 1-byte length
                Blob.fromArray(Array.append([0x58 : Nat8, Nat8.fromNat(size)], bytes))
            } else {
                // For simplicity, limit to 255 bytes
                Blob.fromArray(Array.append([0x58 : Nat8, 0xFF : Nat8], bytes))
            }
        };
        
        // Encode hash tree for certificate
        private func encodeHashTree(tree: HashTree) : Blob {
            switch (tree) {
                case (#empty) {
                    // CBOR array with 0 (empty)
                    Blob.fromArray([0x81, 0x00]) // Array of 1 element: 0
                };
                case (#pruned(hash)) {
                    // CBOR array with 1 (pruned) and hash
                    let encodedHash = cborEncodeBytes(hash);
                    Blob.fromArray(Array.append([0x82 : Nat8, 0x01 : Nat8], Blob.toArray(encodedHash))) // Array of 2 elements
                };
                case (#fork(left, right)) {
                    // CBOR array with 2 (fork) and two subtrees
                    let leftEncoded = encodeHashTree(left);
                    let rightEncoded = encodeHashTree(right);
                    var result = Buffer.Buffer<Nat8>(10);
                    result.add(0x83); // Array of 3 elements
                    result.add(0x02); // 2 for fork
                    for (b in Blob.toArray(leftEncoded).vals()) { result.add(b) };
                    for (b in Blob.toArray(rightEncoded).vals()) { result.add(b) };
                    Blob.fromArray(Buffer.toArray(result))
                };
                case (#labeled(key, subtree)) {
                    // CBOR array with 3 (labeled), key, and subtree
                    let encodedKey = cborEncodeBytes(key);
                    let encodedSubtree = encodeHashTree(subtree);
                    var result = Buffer.Buffer<Nat8>(10);
                    result.add(0x83); // Array of 3 elements
                    result.add(0x03); // 3 for labeled
                    for (b in Blob.toArray(encodedKey).vals()) { result.add(b) };
                    for (b in Blob.toArray(encodedSubtree).vals()) { result.add(b) };
                    Blob.fromArray(Buffer.toArray(result))
                };
                case (#leaf(value)) {
                    // CBOR array with 4 (leaf) and value
                    let encodedValue = cborEncodeBytes(value);
                    Blob.fromArray(Array.append([0x82 : Nat8, 0x04 : Nat8], Blob.toArray(encodedValue))) // Array of 2 elements
                };
            }
        };
        

        // Update certified data
        private func updateCertifiedData() : () {
            Debug.print("🔐 Updating certified data...");
            Debug.print("  Total paths in responseHashes: " # Nat.toText(responseHashes.size()));
            
            // We only store one path (""), so build a simple tree with 3 branches
            switch (responseHashes.get("")) {
                case null {
                    Debug.print("  ⚠️ No hash for root path \"\"");
                    let tree : HashTree = #empty;
                    let treeRootHash = hashOfTree(tree);
                    CertifiedData.set(treeRootHash);
                };
                case (?hash) {
                    // Build tree with 3 branches as per v1 HTTP-cert spec
                    // Order matters: content-encoding, content-type, sha256 (alphabetical)
                    let assetNode : HashTree = #fork(
                        #fork(
                            #labeled(Text.encodeUtf8("content-encoding"), #leaf(Text.encodeUtf8("identity"))),
                            #labeled(Text.encodeUtf8("content-type"), #leaf(Text.encodeUtf8("text/html; charset=UTF-8")))
                        ),
                        #labeled(Text.encodeUtf8("sha256"), #leaf(hash))
                    );
                    
                    let tree : HashTree = #labeled(
                        Text.encodeUtf8("http_assets"),
                        #labeled(
                            Text.encodeUtf8(""),
                            assetNode
                        )
                    );
                    
                    let treeRootHash = hashOfTree(tree);
                    CertifiedData.set(treeRootHash);
                    Debug.print("🔐 Updated certified data with tree root hash for single path: " # debug_show(Blob.toArray(treeRootHash)));
                    Debug.print("🔐 Tree structure: http_assets -> \"\" -> {sha256, content-type, content-encoding}");
                };
            };
        };
        
        // Merge two hash trees into a fork
        private func mergeHashTrees(tree1: HashTree, tree2: HashTree) : HashTree {
            switch (tree1, tree2) {
                case (#empty, _) { tree2 };
                case (_, #empty) { tree1 };
                case _ {
                    // Create a fork with both trees
                    #fork(tree1, tree2)
                };
            };
        };
        
        // Store text content
        public func storeText(path: Text, content: Blob) : () {
            // Create the full HTTP response that will be served
            let headers = [
                ("content-type", "text/plain"),
                ("access-control-allow-origin", "*")
            ];
            let response : StoredResponse = {
                body = content;
                headers = headers;
                status_code = 200;
            };
            
            // Store the response
            assets.put(path, response);
            
            // According to the IC v2 spec: hash only the response body
            let responseHash = sha256(response.body);
            responseHashes.put(path, responseHash);
            
            Debug.print("🔐 Stored text asset:");
            Debug.print("  Path: '" # path # "'");
            Debug.print("  Content size: " # Nat.toText(content.size()) # " bytes");
            Debug.print("  Body hash: " # debug_show(Blob.toArray(responseHash)));
            updateCertifiedData();
        };
        
        // Expose CBOR encoding for testing
        public func encodeCborTree(tree: HashTree) : Blob {
            encodeHashTree(tree)
        };
        
        // Store with content type
        public func store(path: Text, content: Blob, contentType: Text) : () {
            // Create the full HTTP response that will be served
            let headers = [
                ("content-type", contentType),
                ("access-control-allow-origin", "*")
            ];
            let response : StoredResponse = {
                body = content;
                headers = headers;
                status_code = 200;
            };
            
            // Store the response
            assets.put(path, response);
            
            // According to the IC v2 spec: hash only the response body
            let responseHash = sha256(response.body);
            responseHashes.put(path, responseHash);
            
            Debug.print("🔐 Stored asset with content type:");
            Debug.print("  Path: '" # path # "'");
            Debug.print("  Content type: " # contentType);
            Debug.print("  Body size: " # Nat.toText(content.size()) # " bytes");
            Debug.print("  Body hash: " # debug_show(Blob.toArray(responseHash)));
            
            updateCertifiedData();
        };
        
        // Check if asset exists
        public func hasAsset(path: Text) : Bool {
            Option.isSome(assets.get(path))
        };
        
        // Get all stored asset paths (for debugging)
        public func getAllAssetPaths() : [Text] {
            Iter.toArray(assets.keys())
        };
        
        // Get response hash for a path (for debugging)
        public func getResponseHash(path: Text) : ?Blob {
            responseHashes.get(path)
        };
        
        // Serve content
        public func serve(path: Text, req: HttpRequest) : HttpResponse {
            // Map root path "/" to empty string "" for asset lookup
            let lookupPath = if (path == "/") { "" } else { path };
            Debug.print("🔐 Serving request for path: '" # path # "' (lookup: '" # lookupPath # "')");
            Debug.print("  Available assets: " # debug_show(Iter.toArray(assets.keys())));
            
            switch (assets.get(lookupPath)) {
                case null {
                    Debug.print("  ❌ Asset not found for path: '" # lookupPath # "'");
                    // Not found
                    {
                        body = Text.encodeUtf8("Not found");
                        headers = [("content-type", "text/plain")];
                        status_code = 404;
                    }
                };
                case (?storedResponse) {
                    Debug.print("  ✅ Found asset for path: '" # lookupPath # "'");
                    
                    // Verify we only have the expected paths
                    Debug.print("  All paths in responseHashes:");
                    for (p in responseHashes.keys()) {
                        Debug.print("    - \"" # p # "\"");
                    };
                    
                    // Build headers including IC-Certificate
                    var headers = Buffer.Buffer<(Text, Text)>(storedResponse.headers.size() + 2);
                    
                    // Add stored headers
                    for (header in storedResponse.headers.vals()) {
                        headers.add(header);
                    };
                    
                    // Add IC-Certificate header
                    switch (CertifiedData.getCertificate()) {
                        case null { 
                            Debug.print("  ⚠️ No certificate available from CertifiedData");
                        };
                        case (?cert) {
                            Debug.print("  📜 Certificate available, size: " # Nat.toText(cert.size()) # " bytes");
                            
                            // Generate tree for this specific path only
                            switch (responseHashes.get(lookupPath)) {
                                case null {
                                    Debug.print("  ⚠️ No response hash for path: '" # lookupPath # "'");
                                };
                                case (?hash) {
                                    // Build tree with 3 branches as per v1 HTTP-cert spec
                                    // Order matters: content-encoding, content-type, sha256 (alphabetical)
                                    let assetNode : HashTree = #fork(
                                        #fork(
                                            #labeled(Text.encodeUtf8("content-encoding"), #leaf(Text.encodeUtf8("identity"))),
                                            #labeled(Text.encodeUtf8("content-type"), #leaf(Text.encodeUtf8("text/html; charset=UTF-8")))
                                        ),
                                        #labeled(Text.encodeUtf8("sha256"), #leaf(hash))
                                    );
                                    
                                    let tree : HashTree = #labeled(
                                        Text.encodeUtf8("http_assets"),
                                        #labeled(
                                            Text.encodeUtf8(lookupPath),
                                            assetNode
                                        )
                                    );
                                    
                                    let encodedTree = encodeHashTree(tree);
                                    Debug.print("  ✅ Generated tree with 3 branches, size: " # Nat.toText(encodedTree.size()) # " bytes");
                                    
                                    // Verify witness tree hash
                                    let witnessHash = hashOfTree(tree);
                                    Debug.print("  Witness tree hash: " # debug_show(Blob.toArray(witnessHash)));
                                    Debug.print("  This hash should match the certified data hash from updateCertifiedData");
                                    
                                    let certHeader = "certificate=:" # base64UrlEncode(cert) # ":, " #
                                        "tree=:" # base64UrlEncode(encodedTree) # ":";
                                    Debug.print("  IC-Certificate header length: " # Nat.toText(certHeader.size()));
                                    Debug.print("  Total headers before adding IC-Certificate: " # Nat.toText(headers.size()));
                                    
                                    headers.add(("IC-Certificate", certHeader));
                                    headers.add(("Access-Control-Expose-Headers", "IC-Certificate"));
                                };
                            };
                        };
                    };
                    
                    {
                        body = storedResponse.body;
                        headers = Buffer.toArray(headers);
                        status_code = storedResponse.status_code;
                    }
                };
            }
        };
    };
}