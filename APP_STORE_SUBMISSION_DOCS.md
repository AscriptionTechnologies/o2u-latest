# App Store Submission Documents

## Overview

This document provides information about the Privacy Policy and Account Deletion pages created for App Store submission compliance.

## Files Created

### 1. Privacy Policy
**File:** `docs/privacy-policy.html`
**Purpose:** Comprehensive privacy policy for App Store compliance

### 2. Account Deletion Page
**File:** `docs/account-deletion-appstore.html`
**Purpose:** User-facing account deletion instructions and process

## Hosting Instructions

### For App Store Submission

You need to host these HTML files on a publicly accessible URL. Here are your options:

#### Option 1: GitHub Pages (Free & Easy)

1. Create a new repository (e.g., `only2u-policies`)
2. Upload both HTML files
3. Enable GitHub Pages in repository settings
4. Your URLs will be:
   - `https://yourusername.github.io/only2u-policies/privacy-policy.html`
   - `https://yourusername.github.io/only2u-policies/account-deletion-appstore.html`

#### Option 2: Your Own Domain

1. Upload files to your web hosting
2. Accessible at:
   - `https://yourdomain.com/privacy-policy.html`
   - `https://yourdomain.com/account-deletion.html`

#### Option 3: Netlify/Vercel (Free)

1. Drag and drop the `docs` folder to Netlify/Vercel
2. Get instant public URLs

## App Store Connect Setup

### Privacy Policy URL

In App Store Connect → App Information:
```
Privacy Policy URL: https://your-hosted-url.com/privacy-policy.html
```

### Account Deletion URL

In App Store Connect → App Privacy → Data Deletion:
```
Account Deletion URL: https://your-hosted-url.com/account-deletion-appstore.html
```

## What's Included

### Privacy Policy Covers:

✅ Information Collection
- User-provided data
- Automatically collected data
- Third-party data sources

✅ Data Usage
- Service provision
- Personalization
- AI features (face swap, virtual try-on)
- Communication
- Analytics

✅ Data Sharing
- Service providers (Akool, Razorpay, Cloudinary, Supabase)
- Vendors and resellers
- Legal requirements
- Business transfers

✅ AI & Face Recognition
- Face swap feature details
- Virtual try-on processing
- No biometric storage
- User consent requirements

✅ User Rights
- Access, correction, deletion
- Data portability
- Opt-out options
- GDPR compliance
- CCPA compliance

✅ Security Measures
- Encryption
- Secure authentication
- Data protection

✅ Contact Information
- privacy@only2u.com
- support@only2u.com

### Account Deletion Page Covers:

✅ Two Deletion Methods
- In-app deletion (step-by-step)
- Email request process

✅ Deletion Timeline
- Immediate: Account deactivation
- 7 days: Active data removal
- 30 days: Complete deletion
- 90 days: Backup deletion

✅ What Gets Deleted
- Personal information
- Profile data
- Collections & wishlists
- AI-generated content
- Addresses & payment info
- Coins & rewards

✅ What's Retained (Anonymized)
- Order history (7 years for tax compliance)
- Transaction records
- Legal compliance data

✅ Grace Period
- 7 days to cancel deletion
- Instructions for cancellation

✅ FAQs
- Reactivation (not possible)
- Pending orders
- Reviews (anonymized)
- Coin balance (forfeited)

✅ Special Considerations
- Vendor/reseller accounts
- Pending payments
- Product listings

## Email Addresses to Update

Before submission, update these placeholder emails in the HTML files:

1. **privacy@only2u.com** - Privacy inquiries
2. **support@only2u.com** - General support and account deletion
3. **[Your Company Address]** - Physical address in privacy policy

### Find and Replace:

```bash
# In privacy-policy.html
privacy@only2u.com → your-actual-privacy-email@domain.com
support@only2u.com → your-actual-support-email@domain.com
[Your Company Address] → Your actual business address

# In account-deletion-appstore.html  
support@only2u.com → your-actual-support-email@domain.com
privacy@only2u.com → your-actual-privacy-email@domain.com
```

## Design Features

Both pages include:

- ✅ **Mobile-responsive** design
- ✅ **Professional styling** with brand colors (#F53F7A)
- ✅ **Clear navigation** and structure
- ✅ **Visual hierarchy** with colored boxes (info, warning, danger, success)
- ✅ **Easy-to-read** typography
- ✅ **Gradient backgrounds** for modern look
- ✅ **Accessible** color contrast
- ✅ **Print-friendly** (if needed)

## App Store Requirements Met

### Privacy Policy
✅ Clear explanation of data collection
✅ Third-party services disclosed
✅ AI/ML features explained
✅ User rights outlined
✅ Contact information provided
✅ GDPR/CCPA compliance
✅ Children's privacy addressed
✅ Security measures described

### Account Deletion
✅ Clear step-by-step instructions
✅ Multiple deletion methods
✅ Timeline clearly stated
✅ Data retention explained
✅ Contact information provided
✅ Vendor account handling
✅ Legal compliance addressed
✅ User rights respected

## Testing Before Submission

1. **Open both HTML files in browser**
2. **Check all links work** (mailto links, internal links)
3. **Test on mobile devices** (responsive design)
4. **Verify email addresses** are correct
5. **Update company information** if needed
6. **Test mailto links** open email client correctly

## Compliance Checklist

- [ ] Privacy policy hosted on public URL
- [ ] Account deletion page hosted on public URL
- [ ] Email addresses updated to real ones
- [ ] Company address added (if applicable)
- [ ] Links tested and working
- [ ] Mobile responsive verified
- [ ] URLs added to App Store Connect
- [ ] Legal review completed (recommended)

## Additional Notes

### Privacy Policy Updates
- Update "Last Updated" date when making changes
- Notify users of significant changes
- Keep previous versions archived

### Account Deletion Process
- Ensure in-app deletion feature works
- Test email request handling
- Verify data is actually deleted
- Confirm anonymization of retained data

## Support Email Template

When users email for account deletion, use this template for response:

```
Subject: Account Deletion Request Received - Only2U

Dear [User Name],

We have received your request to delete your Only2U account associated with [email/phone].

Your account deletion will be processed according to this timeline:
- Immediate: Account deactivated
- Within 7 days: Personal data removed
- Within 30 days: Complete deletion from all systems

You have 7 days to cancel this request by replying to this email.

If you have any questions, please don't hesitate to contact us.

Best regards,
Only2U Support Team
support@only2u.com
```

## Resources

- **GDPR Guidelines:** https://gdpr.eu/
- **CCPA Guidelines:** https://oag.ca.gov/privacy/ccpa
- **App Store Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Google Play Guidelines:** https://support.google.com/googleplay/android-developer/answer/9888076

---

**Created:** January 20, 2025
**Status:** ✅ Ready for App Store Submission
**Files:** 
- `docs/privacy-policy.html`
- `docs/account-deletion-appstore.html`

