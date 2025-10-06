import { supabase } from '~/utils/supabase';
import type { 
  Reseller, 
  ResellerProduct, 
  ResellerOrder, 
  ResellerRegistrationForm,
  ResellerProductForm,
  CatalogShareForm,
  ResellerDashboard,
  Product 
} from '~/types/reseller';

export class ResellerService {
  // ===========================
  // RESELLER REGISTRATION
  // ===========================

  static async registerReseller(formData: ResellerRegistrationForm): Promise<Reseller> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('resellers')
        .insert({
          user_id: user.id,
          ...formData,
          is_verified: false,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error registering reseller:', error);
      throw error;
    }
  }

  static async getResellerByUserId(userId: string): Promise<Reseller | null> {
    try {
      const { data, error } = await supabase
        .from('resellers')
        .select(`
          *,
          user:users(
            id,
            name,
            email,
            phone,
            profilePhoto
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No reseller found
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching reseller:', error);
      throw error;
    }
  }

  static async updateResellerProfile(resellerId: string, updates: Partial<Reseller>): Promise<Reseller> {
    try {
      const { data, error } = await supabase
        .from('resellers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', resellerId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating reseller profile:', error);
      throw error;
    }
  }

  // ===========================
  // RESELLER PRODUCTS
  // ===========================

  static async addProductToResellerCatalog(
    resellerId: string, 
    productForm: ResellerProductForm
  ): Promise<ResellerProduct> {
    try {
      // Get the base price from the product variant
      const { data: productData, error: productError } = await supabase
        .from('product_variants')
        .select('price')
        .eq('id', productForm.variant_id || productForm.product_id)
        .single();

      if (productError) {
        throw productError;
      }

      const basePrice = productData.price;

      const { data, error } = await supabase
        .from('reseller_products')
        .insert({
          reseller_id: resellerId,
          base_price: basePrice,
          ...productForm
        })
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding product to reseller catalog:', error);
      throw error;
    }
  }

  static async getResellerProducts(resellerId: string): Promise<ResellerProduct[]> {
    try {
      const { data, error } = await supabase
        .from('reseller_products')
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .eq('reseller_id', resellerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching reseller products:', error);
      throw error;
    }
  }

  static async updateResellerProduct(
    resellerProductId: string, 
    updates: Partial<ResellerProduct>
  ): Promise<ResellerProduct> {
    try {
      const { data, error } = await supabase
        .from('reseller_products')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', resellerProductId)
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating reseller product:', error);
      throw error;
    }
  }

  static async removeProductFromResellerCatalog(resellerProductId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reseller_products')
        .update({ is_active: false })
        .eq('id', resellerProductId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error removing product from reseller catalog:', error);
      throw error;
    }
  }

  // ===========================
  // CATALOG SHARING
  // ===========================

  static async shareProductCatalog(
    resellerId: string,
    shareForm: CatalogShareForm
  ): Promise<void> {
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          image_urls,
          video_urls,
          category:categories(name),
          variants:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .eq('id', shareForm.product_id)
        .single();

      if (productError) {
        throw productError;
      }

      // Get reseller product info
      const { data: resellerProduct, error: resellerProductError } = await supabase
        .from('reseller_products')
        .select('selling_price, margin_percentage')
        .eq('reseller_id', resellerId)
        .eq('product_id', shareForm.product_id)
        .single();

      if (resellerProductError) {
        throw resellerProductError;
      }

      // Generate share content
      const shareContent = this.generateCatalogShareContent(product, resellerProduct, shareForm);

      // Record the share
      await supabase
        .from('reseller_catalog_shares')
        .insert({
          reseller_id: resellerId,
          product_id: shareForm.product_id,
          share_method: shareForm.share_method,
          share_content: shareContent,
          recipient_count: shareForm.recipient_contacts?.length || 1
        });

      // Here you would integrate with actual sharing services (WhatsApp, Telegram, etc.)
      // For now, we'll just log the content
      console.log('Catalog share content:', shareContent);
      
    } catch (error) {
      console.error('Error sharing product catalog:', error);
      throw error;
    }
  }

  private static generateCatalogShareContent(
    product: any,
    resellerProduct: any,
    shareForm: CatalogShareForm
  ): string {
    const availableSizes = product.variants?.map((v: any) => v.size?.name).filter(Boolean).join(', ');
    const availableColors = product.variants?.map((v: any) => v.color?.name).filter(Boolean).join(', ');
    
    let content = `🛍️ *${product.name}*\n\n`;
    content += `📝 ${product.description}\n\n`;
    content += `💰 *Price: ₹${resellerProduct.selling_price}*\n`;
    content += `📏 *Available Sizes: ${availableSizes}*\n`;
    content += `🎨 *Available Colors: ${availableColors}*\n\n`;
    
    if (shareForm.custom_message) {
      content += `💬 *Message:* ${shareForm.custom_message}\n\n`;
    }
    
    content += `🛒 Order now and get the best deals!\n`;
    content += `📱 Contact me for more details`;

    return content;
  }

  // ===========================
  // RESELLER ORDERS
  // ===========================

  static async getResellerOrders(resellerId: string): Promise<ResellerOrder[]> {
    try {
      const { data, error } = await supabase
        .from('reseller_orders')
        .select(`
          *,
          items:reseller_order_items(
            id,
            quantity,
            unit_price,
            total_price,
            margin_amount,
            product:products(
              id,
              name,
              image_urls
            ),
            variant:product_variants(
              size:sizes(name),
              color:colors(name)
            )
          )
        `)
        .eq('reseller_id', resellerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching reseller orders:', error);
      throw error;
    }
  }

  static async createResellerOrder(
    resellerId: string,
    orderData: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      customer_address: string;
      customer_city: string;
      customer_state: string;
      customer_pincode: string;
      items: Array<{
        product_id: string;
        variant_id?: string;
        quantity: number;
        unit_price: number;
      }>;
      payment_method: string;
    }
  ): Promise<ResellerOrder> {
    try {
      // Calculate totals
      const totalAmount = orderData.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      
      // Get reseller commission rate
      const { data: reseller, error: resellerError } = await supabase
        .from('resellers')
        .select('commission_rate')
        .eq('id', resellerId)
        .single();

      if (resellerError) {
        throw resellerError;
      }

      const resellerCommission = (totalAmount * reseller.commission_rate) / 100;
      const platformCommission = totalAmount - resellerCommission;

      // Generate order number
      const orderNumber = `RO${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('reseller_orders')
        .insert({
          reseller_id: resellerId,
          order_number: orderNumber,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone,
          customer_email: orderData.customer_email,
          customer_address: orderData.customer_address,
          customer_city: orderData.customer_city,
          customer_state: orderData.customer_state,
          customer_pincode: orderData.customer_pincode,
          total_amount: totalAmount,
          reseller_commission: resellerCommission,
          platform_commission: platformCommission,
          payment_method: orderData.payment_method,
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        reseller_price: item.unit_price, // This should be calculated based on reseller's margin
        margin_amount: 0 // This should be calculated based on reseller's margin
      }));

      const { error: itemsError } = await supabase
        .from('reseller_order_items')
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      return order;
    } catch (error) {
      console.error('Error creating reseller order:', error);
      throw error;
    }
  }

  // ===========================
  // DASHBOARD & ANALYTICS
  // ===========================

  static async getResellerDashboard(resellerId: string): Promise<ResellerDashboard> {
    try {
      // Get basic stats
      const [productsResult, ordersResult, earningsResult] = await Promise.all([
        supabase
          .from('reseller_products')
          .select('id, is_active')
          .eq('reseller_id', resellerId),
        
        supabase
          .from('reseller_orders')
          .select('id, status, total_amount, reseller_commission, created_at')
          .eq('reseller_id', resellerId),
        
        supabase
          .from('reseller_earnings')
          .select('amount, status, created_at')
          .eq('reseller_id', resellerId)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (earningsResult.error) throw earningsResult.error;

      const products = productsResult.data || [];
      const orders = ordersResult.data || [];
      const earnings = earningsResult.data || [];

      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.is_active).length;
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      
      const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
      const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

      // Calculate monthly earnings
      const currentMonth = new Date();
      currentMonth.setDate(1);
      const lastMonth = new Date(currentMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const thisMonthEarnings = orders
        .filter(o => new Date(o.created_at) >= currentMonth)
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      const lastMonthEarnings = orders
        .filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= lastMonth && orderDate < currentMonth;
        })
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      // Get recent orders
      const recentOrders = orders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      // Get top products (mock data for now)
      const topProducts: any[] = [];

      return {
        total_products: totalProducts,
        active_products: activeProducts,
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
        this_month_earnings: thisMonthEarnings,
        last_month_earnings: lastMonthEarnings,
        recent_orders: recentOrders as ResellerOrder[],
        top_products: topProducts,
        analytics: {
          daily_revenue: [], // Would need to implement proper analytics
          weekly_orders: [],
          monthly_earnings: []
        }
      };
    } catch (error) {
      console.error('Error fetching reseller dashboard:', error);
      throw error;
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  static async isUserReseller(userId: string): Promise<boolean> {
    try {
      const reseller = await this.getResellerByUserId(userId);
      return reseller !== null;
    } catch (error) {
      console.error('Error checking if user is reseller:', error);
      return false;
    }
  }

  static calculateSellingPrice(basePrice: number, marginPercentage: number): number {
    return basePrice + (basePrice * marginPercentage / 100);
  }

  static calculateMargin(basePrice: number, sellingPrice: number): number {
    return ((sellingPrice - basePrice) / basePrice) * 100;
  }
}
