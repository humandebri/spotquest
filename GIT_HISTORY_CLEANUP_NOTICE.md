# Git History Cleanup Notice

## ⚠️ Important: Git History Has Been Rewritten

On January 1, 2025, the Git history of this repository was cleaned to remove accidentally committed Google Maps API keys.

### What Changed
- All historical commits containing the Google Maps API key have been modified
- The API key `AIzaSyC7Nu7P1OUVwhdG3gQjrwmyscj9lfNXXaM` was replaced with `YOUR_API_KEY_HERE` in all historical commits
- Commit hashes have changed due to the history rewrite

### Backup Information
- A backup branch was created before cleanup: `backup-before-cleanup`
- Original commit (before cleanup): `809198e`
- New commit (after cleanup): `4d0068c`

### Action Required for Team Members

**All team members must:**

1. **Save any local changes**
   ```bash
   git stash
   ```

2. **Backup your local repository**
   ```bash
   cp -r ~/Desktop/ICP/Guess-the-Spot ~/Desktop/ICP/Guess-the-Spot-backup
   ```

3. **Force update from remote**
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

4. **Apply your saved changes**
   ```bash
   git stash pop
   ```

### Setting Up API Keys

The Google Maps API key is now stored in environment variables:

1. Create a `.env` file in `src/frontend/`:
   ```
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

2. For EAS builds, the API key is configured in `eas.json`

### Security Best Practices

- Never commit API keys or secrets to version control
- Always use environment variables for sensitive data
- Add `.env` files to `.gitignore`
- Review commits before pushing to ensure no secrets are included

### If You Need the Old History

The backup branch `backup-before-cleanup` contains the original history with the exposed API key. This branch should be deleted after confirming everything works correctly.

To delete the backup branch:
```bash
git branch -D backup-before-cleanup
```

### Questions?

If you have any issues or questions about this cleanup, please contact the repository maintainer.