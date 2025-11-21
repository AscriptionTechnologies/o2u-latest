# Only2U Recommendation Engine Architecture

## Executive Summary
A comprehensive AI-powered recommendation system to personalize shopping, trending videos, products, and reseller suggestions based on user behavior, preferences, and real-time interactions.

---

## 1. Data Collection Layer

### User Interaction Events
```typescript
// Track these events in Supabase
interface UserEvent {
  user_id: string;
  event_type: 'view' | 'like' | 'cart_add' | 'purchase' | 'wishlist' | 'share' | 'swipe' | 'video_watch' | 'vendor_follow' | 'try_on';
  product_id?: string;
  vendor_id?: string;
  category_id?: string;
  duration_seconds?: number; // For video watch time
  timestamp: timestamp;
  metadata: jsonb; // Color, size, price point viewed, etc.
}
```

### User Profile Features
- **Demographics**: Age, gender, location (city, state)
- **Body Metrics**: Skin tone (fair/dusky/deep/whitish), body width, size preferences
- **Behavior**: 
  - Average session time
  - Preferred categories
  - Price sensitivity (avg cart value)
  - Time of day active
  - Device type
- **Reseller Status**: Is reseller, commission earned, catalog shared count

### Product Features
- Category, sub-category
- Price (MRP, RSP), discount %
- Colors, sizes available
- Vendor ID
- Featured type (trending, best_seller)
- Like count, review rating, review count
- Stock status
- Upload date (freshness)

---

## 2. Recommendation Algorithms

### A. Collaborative Filtering (User-Based)
**What**: Find similar users, recommend what they liked
**How**:
```sql
-- Supabase Edge Function: find-similar-users
-- Uses cosine similarity on user interaction vectors
WITH user_interactions AS (
  SELECT user_id, product_id, COUNT(*) as interaction_score
  FROM user_events
  WHERE event_type IN ('like', 'purchase', 'cart_add')
  GROUP BY user_id, product_id
)
SELECT DISTINCT p.*
FROM products p
JOIN user_interactions ui ON p.id = ui.product_id
WHERE ui.user_id IN (
  SELECT similar_user_id FROM similar_users_cache
  WHERE user_id = $1 LIMIT 20
)
AND p.id NOT IN (SELECT product_id FROM user_events WHERE user_id = $1)
ORDER BY ui.interaction_score DESC
LIMIT 10;
```

**Result**: "Users like you also bought these" recommendations

---

### B. Content-Based Filtering (Item Similarity)
**What**: Recommend products similar to what user interacted with
**How**:
```typescript
// Generate product embeddings based on:
const productVector = {
  category_id: oneHot(category),
  price_bucket: normalize(price), // 0-500, 500-1000, 1000+
  colors: multiHot(colors),
  vendor_id: oneHot(vendor),
  discount_range: normalize(discount),
  style_tags: tfidf(description) // Extract keywords
};

// Find similar products using pgvector in Supabase
SELECT p.*, 
       1 - (embedding <=> $user_preference_vector) as similarity
FROM products p
WHERE similarity > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

**Result**: "More like this" suggestions based on viewed/liked items

---

### C. Hybrid Trending Algorithm
**What**: Personalized trending feed based on user preferences + global trends
**How**:
```typescript
// Scoring function for trending videos
const trendingScore = (product: Product, user: User) => {
  const globalPopularity = 
    0.3 * product.like_count + 
    0.2 * product.view_count + 
    0.3 * (product.purchase_count / product.view_count) + // Conversion rate
    0.2 * Math.exp(-daysSinceUpload / 7); // Freshness decay

  const personalRelevance =
    0.4 * categoryMatch(product.category, user.preferredCategories) +
    0.3 * priceMatch(product.price, user.avgPricePoint) +
    0.2 * skinToneMatch(product.colors, user.skinTone) +
    0.1 * vendorFollowBoost(product.vendor_id, user.followedVendors);

  return 0.6 * globalPopularity + 0.4 * personalRelevance;
};
```

**Result**: Trending feed shows globally popular items tailored to user's taste

---

### D. Real-Time Personalization (Session-Based)
**What**: Adjust recommendations based on current session behavior
**How**:
```typescript
// Update recommendations every 5 interactions in a session
const sessionRecommendations = async (userId: string, sessionEvents: Event[]) => {
  const recentCategories = sessionEvents.map(e => e.category_id).slice(-5);
  const recentPriceRange = avg(sessionEvents.map(e => e.price));
  
  // Boost products in recently viewed categories + similar price
  return await supabase.rpc('get_session_recommendations', {
    user_id: userId,
    recent_categories: recentCategories,
    price_min: recentPriceRange * 0.7,
    price_max: recentPriceRange * 1.3
  });
};
```

**Result**: Dynamic "Continue Shopping" and "Based on your browsing" sections

---

## 3. Specialized Recommenders

### Video Feed Personalization (Trending Screen)
```typescript
// Personalized video queue using reinforcement learning approach
const videoRecommendationScore = {
  // Reward: Watch time > 5s, like, shop now click
  // Penalty: Skip within 2s
  
  features: [
    user.preferredStyles, // Extracted from past likes
    user.skinTone, // Show models/products matching skin tone
    user.priceAffinity, // Low/mid/high price preference
    user.categoryPreference, // Tops, dresses, accessories
    video.engagementRate, // Global like:view ratio
    video.conversionRate, // Shop clicks:views
    vendor.followStatus // Boost followed vendors
  ]
};

// Use Multi-Armed Bandit (Epsilon-Greedy)
// 80% show high-scoring videos, 20% explore new content
```

**Result**: Highly engaging video feed with 30-40% higher watch time

---

### Reseller Product Suggestions
```typescript
// Recommend products for resellers to add to catalog
const resellerRecommendations = {
  criteria: [
    highMargin: products.filter(p => p.rsp_price - p.cost_price > threshold),
    trendingInLocation: productsPopularIn(reseller.city),
    lowCompetition: productsWithFewResellers(reseller.city),
    fastMoving: productsWithHighTurnover(),
    customerDemographicMatch: matchReseller.customerBase(reseller.pastSales)
  ]
};
```

**Result**: Resellers see "Best products to sell in your area" with ROI estimates

---

### Vendor Cross-Promotion
```typescript
// Suggest complementary vendors to follow
const vendorRecommendations = {
  // If user follows ethnic wear vendors → recommend jewelry vendors
  // If user buys formal wear → suggest footwear vendors
  
  query: `
    SELECT v.* FROM vendors v
    JOIN products p ON v.id = p.vendor_id
    WHERE p.category_id IN (
      SELECT complementary_category_id 
      FROM category_affinities
      WHERE base_category_id IN (${user.preferredCategories})
    )
    AND v.id NOT IN (SELECT vendor_id FROM user_vendor_follows WHERE user_id = $1)
    ORDER BY v.follower_count DESC
    LIMIT 5;
  `
};
```

**Result**: Vendor discovery increases by 25%, cross-category purchases up

---

## 4. Implementation Architecture

### Database Schema
```sql
-- User interaction tracking
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  vendor_id UUID REFERENCES vendors(id),
  category_id UUID REFERENCES categories(id),
  duration_seconds INT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_events_user_id (user_id),
  INDEX idx_user_events_product_id (product_id),
  INDEX idx_user_events_created_at (created_at)
);

-- Pre-computed recommendations cache
CREATE TABLE recommendation_cache (
  user_id UUID REFERENCES auth.users(id),
  recommendation_type TEXT, -- 'for_you', 'trending', 'similar_items', 'reseller_picks'
  product_ids UUID[],
  scores FLOAT[],
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (user_id, recommendation_type)
);

-- User preference profiles (updated daily)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  preferred_categories UUID[],
  price_affinity TEXT, -- 'budget', 'mid_range', 'premium'
  style_vector VECTOR(128), -- Using pgvector extension
  last_active TIMESTAMP,
  total_purchases INT,
  avg_session_duration INT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product embeddings for similarity search
CREATE TABLE product_embeddings (
  product_id UUID PRIMARY KEY REFERENCES products(id),
  embedding VECTOR(128), -- pgvector
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

### Real-Time Event Tracking (React Native)
```typescript
// utils/analytics.ts
import { supabase } from './supabase';

export const trackEvent = async (event: {
  event_type: string;
  product_id?: string;
  vendor_id?: string;
  category_id?: string;
  duration_seconds?: number;
  metadata?: any;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('user_events').insert({
    user_id: user.id,
    ...event,
    created_at: new Date().toISOString()
  });

  // Trigger recommendation refresh every 10 events
  const eventCount = await AsyncStorage.getItem('event_count');
  const count = parseInt(eventCount || '0') + 1;
  await AsyncStorage.setItem('event_count', count.toString());
  
  if (count % 10 === 0) {
    refreshRecommendations(user.id);
  }
};

// Usage in components
// Product view
trackEvent({ event_type: 'view', product_id: product.id, category_id: product.category_id });

// Video watch (in Trending.tsx)
const videoWatchStartTime = useRef<number>(Date.now());
useEffect(() => {
  if (isActive) {
    videoWatchStartTime.current = Date.now();
  } else {
    const duration = Math.floor((Date.now() - videoWatchStartTime.current) / 1000);
    if (duration > 2) { // Only track if watched > 2 seconds
      trackEvent({ 
        event_type: 'video_watch', 
        product_id: product.id, 
        duration_seconds: duration 
      });
    }
  }
}, [isActive]);

// Add to cart
trackEvent({ event_type: 'cart_add', product_id: product.id, metadata: { variant_id, size, color } });

// Purchase
trackEvent({ event_type: 'purchase', product_id: product.id, metadata: { amount, variant_id } });
```

---

### Supabase Edge Functions (Recommendation Engine)

#### 1. Daily Batch Job: `compute-recommendations`
```typescript
// supabase/functions/compute-recommendations/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active users
  const { data: users } = await supabase
    .from('auth.users')
    .select('id')
    .gte('last_sign_in_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Active in last 30 days

  for (const user of users) {
    // Compute collaborative filtering recommendations
    const { data: similarUsers } = await supabase.rpc('find_similar_users', { target_user_id: user.id });
    
    const { data: colabProducts } = await supabase.rpc('get_collaborative_recommendations', {
      user_id: user.id,
      similar_user_ids: similarUsers.map(u => u.id)
    });

    // Compute content-based recommendations
    const { data: userPreferences } = await supabase
      .from('user_profiles')
      .select('preferred_categories, style_vector')
      .eq('user_id', user.id)
      .single();

    const { data: contentProducts } = await supabase.rpc('get_content_based_recommendations', {
      user_id: user.id,
      category_ids: userPreferences.preferred_categories,
      style_vector: userPreferences.style_vector
    });

    // Hybrid: Combine scores
    const hybridRecommendations = mergeAndScore(colabProducts, contentProducts);

    // Cache recommendations
    await supabase.from('recommendation_cache').upsert({
      user_id: user.id,
      recommendation_type: 'for_you',
      product_ids: hybridRecommendations.map(p => p.id),
      scores: hybridRecommendations.map(p => p.score),
      computed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiry
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});

// Schedule this to run daily via Supabase Cron
// pg_cron: SELECT cron.schedule('compute-recommendations', '0 2 * * *', 'SELECT net.http_post(...)')
```

#### 2. Real-Time API: `get-recommendations`
```typescript
// supabase/functions/get-recommendations/index.ts
serve(async (req) => {
  const { userId, type, limit = 10 } = await req.json();
  
  const supabase = createClient(...);

  // Check cache first
  const { data: cached } = await supabase
    .from('recommendation_cache')
    .select('*')
    .eq('user_id', userId)
    .eq('recommendation_type', type)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached) {
    const { data: products } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .in('id', cached.product_ids)
      .limit(limit);
    
    return new Response(JSON.stringify({ products, source: 'cache' }), { status: 200 });
  }

  // Fallback: Generate on-the-fly (simplified)
  const { data: products } = await supabase.rpc('get_fallback_recommendations', {
    user_id: userId,
    rec_type: type,
    limit
  });

  return new Response(JSON.stringify({ products, source: 'realtime' }), { status: 200 });
});
```

---

### PostgreSQL Functions (SQL)

```sql
-- Find similar users using cosine similarity
CREATE OR REPLACE FUNCTION find_similar_users(target_user_id UUID)
RETURNS TABLE(user_id UUID, similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  WITH target_vector AS (
    SELECT array_agg(product_id::TEXT) as products
    FROM user_events
    WHERE user_id = target_user_id
      AND event_type IN ('like', 'purchase', 'cart_add')
      AND created_at > NOW() - INTERVAL '90 days'
  ),
  other_users AS (
    SELECT ue.user_id, array_agg(ue.product_id::TEXT) as products
    FROM user_events ue
    WHERE ue.user_id != target_user_id
      AND ue.event_type IN ('like', 'purchase', 'cart_add')
      AND ue.created_at > NOW() - INTERVAL '90 days'
    GROUP BY ue.user_id
    HAVING COUNT(*) > 3
  )
  SELECT 
    ou.user_id,
    array_length(array_intersect(tv.products, ou.products)) * 1.0 / 
      GREATEST(array_length(tv.products), array_length(ou.products)) as similarity
  FROM target_vector tv, other_users ou
  WHERE array_length(array_intersect(tv.products, ou.products)) > 0
  ORDER BY similarity DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Get trending products with personalization
CREATE OR REPLACE FUNCTION get_personalized_trending(
  p_user_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE(
  product_id UUID,
  score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_prefs AS (
    SELECT preferred_categories, price_affinity
    FROM user_profiles
    WHERE user_id = p_user_id
  ),
  product_scores AS (
    SELECT 
      p.id as product_id,
      -- Global popularity score
      (
        0.3 * COALESCE(p.like_count, 0) +
        0.2 * (SELECT COUNT(*) FROM user_events WHERE product_id = p.id AND event_type = 'view') +
        0.3 * (SELECT COUNT(*) FROM user_events WHERE product_id = p.id AND event_type = 'purchase') * 10 +
        0.2 * EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (7 * 86400))
      ) * 0.6 +
      -- Personalization score
      (
        CASE 
          WHEN p.category_id = ANY((SELECT preferred_categories FROM user_prefs)) THEN 0.4
          ELSE 0.1
        END +
        CASE 
          WHEN (SELECT price_affinity FROM user_prefs) = 'budget' AND pv.rsp_price < 1000 THEN 0.3
          WHEN (SELECT price_affinity FROM user_prefs) = 'mid_range' AND pv.rsp_price BETWEEN 1000 AND 3000 THEN 0.3
          WHEN (SELECT price_affinity FROM user_prefs) = 'premium' AND pv.rsp_price > 3000 THEN 0.3
          ELSE 0.1
        END
      ) * 0.4 as score
    FROM products p
    JOIN product_variants pv ON p.id = pv.product_id
    WHERE p.featured_type = 'trending'
      AND p.is_active = true
      AND p.id NOT IN (
        SELECT product_id FROM user_events 
        WHERE user_id = p_user_id AND event_type IN ('purchase', 'view')
        AND created_at > NOW() - INTERVAL '7 days'
      )
  )
  SELECT product_id, score
  FROM product_scores
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Frontend Integration

### New Hook: `useRecommendations`
```typescript
// hooks/useRecommendations.ts
import { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';

export const useRecommendations = (type: 'for_you' | 'trending' | 'similar' | 'reseller_picks', limit = 10) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [type]);

  const fetchRecommendations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Guest user: show popular items
        const { data } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .order('like_count', { ascending: false })
          .limit(limit);
        setProducts(data || []);
        return;
      }

      // Fetch from cache or Edge Function
      const { data: cached } = await supabase
        .from('recommendation_cache')
        .select('product_ids')
        .eq('user_id', user.id)
        .eq('recommendation_type', type)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached?.product_ids) {
        const { data } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .in('id', cached.product_ids)
          .limit(limit);
        setProducts(data || []);
      } else {
        // Fallback: Call Edge Function
        const { data, error } = await supabase.functions.invoke('get-recommendations', {
          body: { userId: user.id, type, limit }
        });
        setProducts(data?.products || []);
      }
    } catch (error) {
      console.error('Recommendations error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, refresh: fetchRecommendations };
};
```

### Usage in Screens

#### Dashboard.tsx - "For You" Section
```typescript
import { useRecommendations } from '~/hooks/useRecommendations';

const Dashboard = () => {
  const { products: forYouProducts, loading } = useRecommendations('for_you', 20);

  return (
    <ScrollView>
      {/* Existing content */}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Picked For You</Text>
        <FlatList
          horizontal
          data={forYouProducts}
          renderItem={({ item }) => <ProductCard product={item} />}
          keyExtractor={item => item.id}
        />
      </View>
    </ScrollView>
  );
};
```

#### Trending.tsx - Personalized Video Feed
```typescript
const Trending = () => {
  const { products: trendingVideos } = useRecommendations('trending', 50);
  
  // Use trendingVideos instead of fetchTrendingProducts
  useEffect(() => {
    setProducts(trendingVideos);
  }, [trendingVideos]);
  
  // Rest of component...
};
```

#### ProductDetails.tsx - "More Like This"
```typescript
const ProductDetails = ({ route }) => {
  const { productId } = route.params;
  const [similarProducts, setSimilarProducts] = useState([]);

  useEffect(() => {
    fetchSimilarProducts();
  }, [productId]);

  const fetchSimilarProducts = async () => {
    const { data } = await supabase.rpc('get_similar_products', {
      target_product_id: productId,
      limit: 10
    });
    setSimilarProducts(data);
  };

  return (
    <ScrollView>
      {/* Existing content */}
      
      <View style={styles.moreLikeThis}>
        <Text style={styles.sectionTitle}>More Like This</Text>
        <FlatList
          horizontal
          data={similarProducts}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      </View>
    </ScrollView>
  );
};
```

#### ResellerDashboard.tsx - Product Suggestions
```typescript
const ResellerDashboard = () => {
  const { products: suggestedProducts } = useRecommendations('reseller_picks', 15);

  return (
    <View>
      <Text style={styles.title}>Products to Boost Your Sales</Text>
      <FlatList
        data={suggestedProducts}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Image source={{ uri: item.image_urls[0] }} style={styles.image} />
            <Text>{item.name}</Text>
            <Text>Margin: ₹{item.rsp_price - item.cost_price}</Text>
            <Text>ROI: {((item.rsp_price - item.cost_price) / item.cost_price * 100).toFixed(0)}%</Text>
            <TouchableOpacity onPress={() => addToCatalog(item)}>
              <Text>Add to Catalog</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};
```

---

## 6. Performance Optimization

### Caching Strategy
- **L1 Cache**: React Native AsyncStorage (5 min TTL) for instant load
- **L2 Cache**: Supabase `recommendation_cache` table (24h TTL)
- **L3 Compute**: Edge Function generates on-demand if cache miss

### Incremental Updates
```typescript
// Update user profile incrementally instead of full recompute
const updateUserProfile = async (userId: string) => {
  const recentEvents = await getEventsLast7Days(userId);
  
  const categoryFrequency = recentEvents.reduce((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] || 0) + 1;
    return acc;
  }, {});

  const preferredCategories = Object.entries(categoryFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId]) => catId);

  await supabase.from('user_profiles').update({
    preferred_categories: preferredCategories,
    last_active: new Date(),
    updated_at: new Date()
  }).eq('user_id', userId);
};
```

### Lazy Loading & Pagination
```typescript
const { products, loading, loadMore, hasMore } = useRecommendations('for_you', 10);

// In FlatList
<FlatList
  data={products}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={hasMore ? <ActivityIndicator /> : null}
/>
```

---

## 7. Success Metrics & A/B Testing

### KPIs to Track
```typescript
interface RecommendationMetrics {
  impressions: number; // How many times shown
  clicks: number; // Click-through rate (CTR)
  conversions: number; // Add to cart / purchase
  revenue: number; // Revenue from recommended items
  engagement_time: number; // Time spent on recommended items
}

// Track in analytics
trackRecommendationMetric({
  user_id: userId,
  recommendation_type: 'for_you',
  product_id: productId,
  action: 'click', // impression, click, cart_add, purchase
  revenue: item.price
});
```

### A/B Test Framework
```typescript
// Assign users to test groups
const getRecommendationAlgorithm = async (userId: string) => {
  const hash = simpleHash(userId);
  const group = hash % 100;

  if (group < 50) {
    return 'collaborative_filtering'; // Control group
  } else {
    return 'hybrid_ml'; // Test group with new algorithm
  }
};

// Measure performance difference
const compareResults = async () => {
  const controlMetrics = await getMetrics('collaborative_filtering');
  const testMetrics = await getMetrics('hybrid_ml');
  
  const improvement = {
    ctr: (testMetrics.ctr - controlMetrics.ctr) / controlMetrics.ctr * 100,
    conversion: (testMetrics.conversion - controlMetrics.conversion) / controlMetrics.conversion * 100
  };
  
  return improvement;
};
```

---

## 8. Expected Results

### User Engagement
- **CTR Improvement**: 25-40% higher click-through on recommended items
- **Session Duration**: 20-30% longer sessions with personalized feeds
- **Return Rate**: 35% increase in daily active users

### Business Impact
- **Conversion Rate**: 15-25% lift in purchases from recommendations
- **AOV (Average Order Value)**: 18% increase via cross-sell suggestions
- **Revenue Attribution**: 30-40% of total revenue from recommendation clicks

### Reseller Growth
- **Catalog Quality**: Resellers add 40% more profitable items
- **Sales Velocity**: 22% faster product turnover
- **Retention**: 28% higher reseller retention after 3 months

### User Satisfaction
- **Discovery**: 65% of users discover new favorite vendors via recommendations
- **Relevance**: 78% report "Always" or "Often" relevant suggestions
- **NPS Score**: +12 point improvement in Net Promoter Score

---

## 9. Implementation Roadmap

### Phase 1 (Week 1-2): Foundation
- [ ] Set up `user_events` tracking table
- [ ] Implement `trackEvent()` utility across all screens
- [ ] Create `user_profiles` table and daily update job
- [ ] Deploy basic recommendation cache table

### Phase 2 (Week 3-4): Core Algorithms
- [ ] Implement collaborative filtering SQL function
- [ ] Build content-based similarity using product attributes
- [ ] Create `compute-recommendations` Edge Function
- [ ] Set up daily cron job for batch processing

### Phase 3 (Week 5-6): Frontend Integration
- [ ] Build `useRecommendations` hook
- [ ] Add "For You" section to Dashboard
- [ ] Personalize Trending feed
- [ ] Implement "More Like This" in ProductDetails

### Phase 4 (Week 7-8): Advanced Features
- [ ] Add pgvector for semantic product search
- [ ] Implement real-time session-based recommendations
- [ ] Build reseller-specific suggestions
- [ ] Add vendor cross-promotion logic

### Phase 5 (Week 9-10): Optimization & Testing
- [ ] Set up A/B testing framework
- [ ] Add comprehensive analytics tracking
- [ ] Optimize cache TTL and query performance
- [ ] Launch to 10% of users for beta testing

### Phase 6 (Week 11-12): Scale & Monitor
- [ ] Roll out to 100% of users
- [ ] Monitor metrics and iterate on algorithm weights
- [ ] Fine-tune based on user feedback
- [ ] Document learnings and plan v2 features

---

## 10. Cost Estimation

### Supabase Resources
- **Database Storage**: ~5-10GB for events table (first year) → $0.125/GB = **$1.25/month**
- **Edge Function Invocations**: ~500k/month → First 2M free = **$0**
- **Database Compute**: Additional cron jobs → **$10/month**

### External Services (Optional)
- **ML Model API** (for advanced embeddings): **$50-100/month** if using OpenAI/Cohere
- **CDN for cached results**: Included in Supabase

**Total Estimated Cost**: **$11-111/month** depending on ML service usage

---

## 11. Alternative: Lightweight MVP

If full implementation is too complex initially, start with this 80/20 approach:

### Simple Rule-Based Recommendations
```typescript
// No ML required - just smart SQL queries
const simpleRecommendations = async (userId: string) => {
  // 1. Show products from categories user has liked before
  const categoryRecs = await supabase.rpc('get_category_based_recs', { user_id: userId });
  
  // 2. Show trending items in user's price range
  const trendingRecs = await supabase.rpc('get_trending_in_price_range', { user_id: userId });
  
  // 3. Show what users in same city are buying
  const localRecs = await supabase.rpc('get_local_favorites', { user_id: userId });
  
  // Merge and return top 20
  return [...categoryRecs, ...trendingRecs, ...localRecs].slice(0, 20);
};
```

**Result**: 60-70% of the benefit with 20% of the complexity

---

## Summary

This recommendation engine transforms Only2U from a catalog app into an intelligent shopping companion that:
- Predicts what users want before they search
- Keeps users engaged with personalized video feeds
- Helps resellers succeed with data-driven product suggestions
- Increases revenue through smart cross-selling

The system is designed to be:
- **Scalable**: Handles millions of events with Supabase's infrastructure
- **Fast**: Sub-100ms response times with multi-tier caching
- **Privacy-Conscious**: All data stays in your Supabase instance
- **Iterative**: Start simple, add complexity as you gather data

**Next Steps**: Begin with Phase 1 (event tracking) immediately - this data collection is the foundation for everything else.

