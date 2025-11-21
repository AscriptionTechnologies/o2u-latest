import { supabase } from './supabase';

export interface DraftOrderItem {
  product_id: string;
  product_variant_id?: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreateDraftOrderData {
  user_id: string;
  total_amount: number;
  shipping_address: string;
  billing_address: string;
  payment_method: string;
  payment_status: string;
  status: string;
  notes?: string;
  items: DraftOrderItem[];
}

export const createDraftOrder = async (data: CreateDraftOrderData) => {
  try {
    // Generate order number
    const orderNumber = `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create draft order
    const { data: draftOrder, error: orderError } = await supabase
      .from('customer_draft_orders')
      .insert([
        {
          user_id: data.user_id,
          order_number: orderNumber,
          total_amount: data.total_amount,
          shipping_address: data.shipping_address,
          billing_address: data.billing_address,
          payment_method: data.payment_method,
          payment_status: data.payment_status,
          status: data.status,
          notes: data.notes || 'Order created for out-of-stock items',
        },
      ])
      .select('id, order_number')
      .single();

    if (orderError) {
      console.error('Draft order creation error:', orderError);
      throw new Error(orderError.message || 'Failed to create draft order');
    }

    if (!draftOrder) {
      throw new Error('Draft order created but no data returned');
    }

    // Create draft order items
    const orderItemsPayload = data.items.map((item) => ({
      draft_order_id: draftOrder.id,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id || null,
      product_name: item.product_name,
      product_sku: item.product_sku || null,
      product_image: item.product_image || null,
      size: item.size || null,
      color: item.color || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await supabase
      .from('customer_draft_order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error('Draft order items creation error:', itemsError);
      throw new Error(itemsError.message || 'Failed to create draft order items');
    }

    return {
      id: draftOrder.id,
      order_number: draftOrder.order_number,
      status: 'draft_created',
    };
  } catch (error) {
    console.error('Error creating draft order:', error);
    throw error;
  }
};

export const getDraftOrders = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('customer_draft_orders')
      .select(`
        *,
        customer_draft_order_items (
          id,
          product_id,
          product_variant_id,
          product_name,
          product_sku,
          product_image,
          size,
          color,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching draft orders:', error);
      throw new Error(error.message || 'Failed to fetch draft orders');
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching draft orders:', error);
    throw error;
  }
};

export const updateDraftOrderStatus = async (
  draftOrderId: string,
  status: string,
  approvedBy?: string,
  rejectionReason?: string
) => {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = approvedBy;
    }

    if (status === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await supabase
      .from('customer_draft_orders')
      .update(updateData)
      .eq('id', draftOrderId);

    if (error) {
      console.error('Error updating draft order status:', error);
      throw new Error(error.message || 'Failed to update draft order status');
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating draft order status:', error);
    throw error;
  }
};
