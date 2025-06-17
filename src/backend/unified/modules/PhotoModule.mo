import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Option "mo:base/Option";
import Random "mo:base/Random";
import Blob "mo:base/Blob";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Hash "mo:base/Hash";

import PhotoTypes "../../../types/photo";
import Constants "Constants";
import Helpers "Helpers";

module {
    // Photo type for internal storage
    public type Photo = {
        id: Nat;
        owner: Principal;
        uploadTime: Time.Time;
        latitude: Float;
        longitude: Float;
        imageUrl: Text;
        tags: [Text];
        boost: Nat;
        status: { #Active; #Banned; #Deleted };
        qualityScore: Float;
        timesUsed: Nat;
    };
    
    // Scheduled upload request type
    public type ScheduledUploadRequest = {
        uploadRequest: PhotoTypes.PhotoUploadRequest;
        scheduledTime: Time.Time;
        notificationType: {
            #scheduledPhotoPublished;
            #scheduledPhotoFailed;
            #scheduledPhotoReminder;
        };
    };
    
    public class PhotoManager() {
        // Photo storage
        private var photos = TrieMap.TrieMap<Nat, Photo>(Nat.equal, Hash.hash);
        private var nextPhotoId : Nat = 1;
        
        // Scheduling
        private var scheduledPhotos = TrieMap.TrieMap<Principal, Buffer.Buffer<PhotoTypes.ScheduledPhoto>>(Principal.equal, Principal.hash);
        
        // Photo ownership and statistics
        private var ownerPhotos = TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
        private var photoUsageCount = TrieMap.TrieMap<Nat, Nat>(Nat.equal, Hash.hash);
        private var totalPhotos : Nat = 0;
        
        // Admin features
        private var bannedPhotos = TrieMap.TrieMap<Nat, Time.Time>(Nat.equal, Hash.hash);
        
        // Random number generation for photo selection
        private var prng = Random.Finite(Blob.fromArray([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]));
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        // Upload a new photo
        public func uploadPhoto(photo: PhotoTypes.PhotoUploadRequest, userId: Principal) : Result.Result<Nat, Text> {
            // Validate input
            if (Principal.toText(userId) == "") {
                return #err("Invalid user principal");
            };
            
            if (not Helpers.isValidLatitude(photo.meta.lat)) {
                return #err("Invalid latitude");
            };
            
            if (not Helpers.isValidLongitude(photo.meta.lon)) {
                return #err("Invalid longitude");
            };
            
            // Check if user has reached upload limit
            let userPhotos = switch(ownerPhotos.get(userId)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    ownerPhotos.put(userId, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            if (userPhotos.size() >= Constants.MAX_PHOTOS_PER_USER) {
                return #err("Upload limit reached");
            };
            
            // Create new photo
            let photoId = nextPhotoId;
            let now = Time.now();
            
            let newPhoto : Photo = {
                id = photoId;
                owner = userId;
                uploadTime = now;
                latitude = photo.meta.lat;
                longitude = photo.meta.lon;
                imageUrl = ""; // PhotoUploadRequest doesn't have imageUrl
                tags = photo.tags;
                boost = 1; // Default boost
                status = #Active;
                qualityScore = 0.5; // Default quality score
                timesUsed = 0;
            };
            
            // Store photo
            photos.put(photoId, newPhoto);
            userPhotos.add(photoId);
            photoUsageCount.put(photoId, 0);
            
            nextPhotoId += 1;
            totalPhotos += 1;
            
            #ok(photoId)
        };
        
        // Schedule a photo for future upload
        public func schedulePhotoUpload(request: ScheduledUploadRequest, userId: Principal) : Result.Result<Text, Text> {
            // Validate scheduled time
            let now = Time.now();
            if (request.scheduledTime <= now) {
                return #err("Scheduled time must be in the future");
            };
            
            // Check if user has too many scheduled photos
            let userScheduled = switch(scheduledPhotos.get(userId)) {
                case null {
                    let buffer = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(5);
                    scheduledPhotos.put(userId, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            if (userScheduled.size() >= 10) {
                return #err("Too many scheduled photos");
            };
            
            // Create scheduled photo
            let scheduledId = Principal.toText(userId) # "_" # Nat.toText(userScheduled.size());
            
            let scheduled : PhotoTypes.ScheduledPhoto = {
                id = userScheduled.size(); // Use size directly as ID
                photoMeta = request.uploadRequest.meta;
                imageChunks = []; // No chunks for scheduled photos yet
                scheduledPublishTime = request.scheduledTime;
                status = #pending;
                title = request.uploadRequest.title;
                description = request.uploadRequest.description;
                difficulty = request.uploadRequest.difficulty;
                hint = request.uploadRequest.hint;
                tags = request.uploadRequest.tags;
                createdAt = now;
                updatedAt = now;
            };
            
            userScheduled.add(scheduled);
            
            #ok(scheduledId)
        };
        
        // Get random photo for game
        public func getRandomPhoto() : ?Photo {
            let activePhotos = Buffer.Buffer<Photo>(10);
            
            // Collect active, non-banned photos
            for ((id, photo) in photos.entries()) {
                if (photo.status == #Active and bannedPhotos.get(id) == null) {
                    activePhotos.add(photo);
                };
            };
            
            if (activePhotos.size() == 0) {
                return null;
            };
            
            // Select random photo
            let randomIndex = switch(prng.byte()) {
                case null { 0 };
                case (?b) { Nat8.toNat(b) % activePhotos.size() };
            };
            
            let selectedPhoto = activePhotos.get(randomIndex);
            
            // Update usage count
            photoUsageCount.put(selectedPhoto.id, selectedPhoto.timesUsed + 1);
            
            // Return updated photo
            ?{
                selectedPhoto with
                timesUsed = selectedPhoto.timesUsed + 1;
            }
        };
        
        // Get photos by owner
        public func getPhotosByOwner(owner: Principal) : [Photo] {
            switch(ownerPhotos.get(owner)) {
                case null { [] };
                case (?photoIds) {
                    let result = Buffer.Buffer<Photo>(photoIds.size());
                    for (photoId in photoIds.vals()) {
                        switch(photos.get(photoId)) {
                            case null { };
                            case (?photo) { result.add(photo) };
                        };
                    };
                    Buffer.toArray(result)
                };
            }
        };
        
        // Delete photo
        public func deletePhoto(photoId: Nat, requestor: Principal) : Result.Result<(), Text> {
            switch(photos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    if (photo.owner != requestor) {
                        return #err("Unauthorized");
                    };
                    
                    // Update photo status instead of deleting
                    let deletedPhoto = {
                        photo with
                        status = #Deleted;
                    };
                    
                    photos.put(photoId, deletedPhoto);
                    
                    #ok()
                };
            }
        };
        
        // Update photo quality score
        public func updatePhotoQualityScore(photoId: Nat, qualityScore: Float) : Result.Result<(), Text> {
            switch(photos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    let updatedPhoto = {
                        photo with
                        qualityScore = qualityScore;
                    };
                    photos.put(photoId, updatedPhoto);
                    #ok()
                };
            }
        };
        
        // Get photo by ID
        public func getPhoto(photoId: Nat) : ?Photo {
            photos.get(photoId)
        };
        
        // Get scheduled photos for user
        public func getScheduledPhotos(userId: Principal) : [PhotoTypes.ScheduledPhoto] {
            switch(scheduledPhotos.get(userId)) {
                case null { [] };
                case (?scheduled) { Buffer.toArray(scheduled) };
            }
        };
        
        // Cancel scheduled photo
        public func cancelScheduledPhoto(scheduledId: Text, userId: Principal) : Result.Result<(), Text> {
            switch(scheduledPhotos.get(userId)) {
                case null { #err("No scheduled photos found") };
                case (?scheduled) {
                    var found = false;
                    let updated = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(scheduled.size());
                    
                    for (photo in scheduled.vals()) {
                        if (Nat.toText(photo.id) == scheduledId and photo.status == #pending) {
                            found := true;
                            // Update status instead of removing
                            updated.add({
                                photo with
                                status = #cancelled;
                            });
                        } else {
                            updated.add(photo);
                        };
                    };
                    
                    if (not found) {
                        return #err("Scheduled photo not found");
                    };
                    
                    scheduledPhotos.put(userId, updated);
                    #ok()
                };
            }
        };
        
        // Ban photo (admin function)
        public func banPhoto(photoId: Nat) : Result.Result<(), Text> {
            switch(photos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    bannedPhotos.put(photoId, Time.now());
                    
                    let bannedPhoto = {
                        photo with
                        status = #Banned;
                    };
                    
                    photos.put(photoId, bannedPhoto);
                    #ok()
                };
            }
        };
        
        // Get photo statistics
        public func getPhotoStats() : {
            totalPhotos: Nat;
            activePhotos: Nat;
            bannedPhotos: Nat;
            deletedPhotos: Nat;
        } {
            var active = 0;
            var banned = 0;
            var deleted = 0;
            
            for ((_, photo) in photos.entries()) {
                switch(photo.status) {
                    case (#Active) { active += 1 };
                    case (#Banned) { banned += 1 };
                    case (#Deleted) { deleted += 1 };
                };
            };
            
            {
                totalPhotos = totalPhotos;
                activePhotos = active;
                bannedPhotos = banned;
                deletedPhotos = deleted;
            }
        };
        
        // Process scheduled photos (called by heartbeat)
        public func processScheduledPhotos() : async [(Text, Result.Result<Nat, Text>)] {
            let now = Time.now();
            let results = Buffer.Buffer<(Text, Result.Result<Nat, Text>)>(10);
            
            for ((userId, scheduled) in scheduledPhotos.entries()) {
                let updated = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(scheduled.size());
                
                for (photo in scheduled.vals()) {
                    if (photo.status == #pending and photo.scheduledPublishTime <= now) {
                        // Process scheduled upload
                        // Create upload request from scheduled photo
                        let uploadRequest : PhotoTypes.PhotoUploadRequest = {
                            meta = photo.photoMeta;
                            totalChunks = photo.imageChunks.size();
                            scheduledPublishTime = ?photo.scheduledPublishTime;
                            title = photo.title;
                            description = photo.description;
                            difficulty = photo.difficulty;
                            hint = photo.hint;
                            tags = photo.tags;
                        };
                        let uploadResult = uploadPhoto(uploadRequest, userId);
                        results.add((Nat.toText(photo.id), uploadResult));
                        
                        // Update status
                        updated.add({
                            photo with
                            status = #published;
                        });
                    } else {
                        updated.add(photo);
                    };
                };
                
                scheduledPhotos.put(userId, updated);
            };
            
            Buffer.toArray(results)
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            photos: [(Nat, Photo)];
            nextPhotoId: Nat;
            scheduledPhotos: [(Principal, [PhotoTypes.ScheduledPhoto])];
            ownerPhotos: [(Principal, [Nat])];
            photoUsageCount: [(Nat, Nat)];
            totalPhotos: Nat;
            bannedPhotos: [(Nat, Time.Time)];
        } {
            {
                photos = Iter.toArray(photos.entries());
                nextPhotoId = nextPhotoId;
                scheduledPhotos = Array.map<(Principal, Buffer.Buffer<PhotoTypes.ScheduledPhoto>), (Principal, [PhotoTypes.ScheduledPhoto])>(
                    Iter.toArray(scheduledPhotos.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                ownerPhotos = Array.map<(Principal, Buffer.Buffer<Nat>), (Principal, [Nat])>(
                    Iter.toArray(ownerPhotos.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                photoUsageCount = Iter.toArray(photoUsageCount.entries());
                totalPhotos = totalPhotos;
                bannedPhotos = Iter.toArray(bannedPhotos.entries());
            }
        };
        
        public func fromStable(stableData: {
            photos: [(Nat, Photo)];
            nextPhotoId: Nat;
            scheduledPhotos: [(Principal, [PhotoTypes.ScheduledPhoto])];
            ownerPhotos: [(Principal, [Nat])];
            photoUsageCount: [(Nat, Nat)];
            totalPhotos: Nat;
            bannedPhotos: [(Nat, Time.Time)];
        }) {
            photos := TrieMap.fromEntries(stableData.photos.vals(), Nat.equal, Hash.hash);
            nextPhotoId := stableData.nextPhotoId;
            totalPhotos := stableData.totalPhotos;
            bannedPhotos := TrieMap.fromEntries(stableData.bannedPhotos.vals(), Nat.equal, Hash.hash);
            photoUsageCount := TrieMap.fromEntries(stableData.photoUsageCount.vals(), Nat.equal, Hash.hash);
            
            scheduledPhotos := TrieMap.TrieMap<Principal, Buffer.Buffer<PhotoTypes.ScheduledPhoto>>(Principal.equal, Principal.hash);
            for ((user, photos) in stableData.scheduledPhotos.vals()) {
                let buffer = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(photos.size());
                for (photo in photos.vals()) {
                    buffer.add(photo);
                };
                scheduledPhotos.put(user, buffer);
            };
            
            ownerPhotos := TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
            for ((owner, photoIds) in stableData.ownerPhotos.vals()) {
                let buffer = Buffer.Buffer<Nat>(photoIds.size());
                for (photoId in photoIds.vals()) {
                    buffer.add(photoId);
                };
                ownerPhotos.put(owner, buffer);
            };
        };
    };
}