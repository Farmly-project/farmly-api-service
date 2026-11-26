export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_line: string
          created_at: string
          deleted_at: string | null
          id: number
          is_default: boolean
          phone: string
          province: string
          recipient_name: string
          updated_at: string
          user_id: string
          ward: string
        }
        Insert: {
          address_line: string
          created_at?: string
          deleted_at?: string | null
          id?: number
          is_default?: boolean
          phone: string
          province: string
          recipient_name: string
          updated_at?: string
          user_id: string
          ward: string
        }
        Update: {
          address_line?: string
          created_at?: string
          deleted_at?: string | null
          id?: number
          is_default?: boolean
          phone?: string
          province?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
          ward?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          batch_code: string
          created_at: string
          current_quantity: number
          disposed_quantity: number
          exp_date: string | null
          flash_sale_ends_at: string | null
          flash_sale_price: number | null
          harvest_date: string | null
          id: number
          initial_quantity: number
          product_id: number
          qr_code: string | null
          qr_scan_count: number
          sowing_date: string | null
          status: Database["public"]["Enums"]["batch_status_enum"]
          updated_at: string
        }
        Insert: {
          batch_code: string
          created_at?: string
          current_quantity: number
          disposed_quantity?: number
          exp_date?: string | null
          flash_sale_ends_at?: string | null
          flash_sale_price?: number | null
          harvest_date?: string | null
          id?: number
          initial_quantity: number
          product_id: number
          qr_code?: string | null
          qr_scan_count?: number
          sowing_date?: string | null
          status?: Database["public"]["Enums"]["batch_status_enum"]
          updated_at?: string
        }
        Update: {
          batch_code?: string
          created_at?: string
          current_quantity?: number
          disposed_quantity?: number
          exp_date?: string | null
          flash_sale_ends_at?: string | null
          flash_sale_price?: number | null
          harvest_date?: string | null
          id?: number
          initial_quantity?: number
          product_id?: number
          qr_code?: string | null
          qr_scan_count?: number
          sowing_date?: string | null
          status?: Database["public"]["Enums"]["batch_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: number
          created_at: string
          id: number
          product_id: number
          quantity: number
        }
        Insert: {
          cart_id: number
          created_at?: string
          id?: number
          product_id: number
          quantity: number
        }
        Update: {
          cart_id?: number
          created_at?: string
          id?: number
          product_id?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          guest_token: string | null
          id: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_token?: string | null
          id?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_token?: string | null
          id?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          allow_subscription: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          id: number
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          allow_subscription?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          allow_subscription?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      complaint_media: {
        Row: {
          complaint_id: number
          created_at: string
          id: number
          media_type: Database["public"]["Enums"]["media_type_enum"]
          size_kb: number
          url: string
        }
        Insert: {
          complaint_id: number
          created_at?: string
          id?: number
          media_type: Database["public"]["Enums"]["media_type_enum"]
          size_kb: number
          url: string
        }
        Update: {
          complaint_id?: number
          created_at?: string
          id?: number
          media_type?: Database["public"]["Enums"]["media_type_enum"]
          size_kb?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_media_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          created_at: string
          description: string | null
          handled_by: string | null
          id: number
          order_item_id: number
          quantity_affected: number
          reason: Database["public"]["Enums"]["complaint_reason_enum"]
          refund_amount: number | null
          replacement_order_id: number | null
          requested_resolution: Database["public"]["Enums"]["resolution_enum"]
          sales_note: string | null
          status: Database["public"]["Enums"]["complaint_status_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: number
          order_item_id: number
          quantity_affected: number
          reason: Database["public"]["Enums"]["complaint_reason_enum"]
          refund_amount?: number | null
          replacement_order_id?: number | null
          requested_resolution: Database["public"]["Enums"]["resolution_enum"]
          sales_note?: string | null
          status?: Database["public"]["Enums"]["complaint_status_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: number
          order_item_id?: number
          quantity_affected?: number
          reason?: Database["public"]["Enums"]["complaint_reason_enum"]
          refund_amount?: number | null
          replacement_order_id?: number | null
          requested_resolution?: Database["public"]["Enums"]["resolution_enum"]
          sales_note?: string | null
          status?: Database["public"]["Enums"]["complaint_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_schedules: {
        Row: {
          created_at: string
          delivery_date: string
          id: number
          order_id: number | null
          status: Database["public"]["Enums"]["schedule_status_enum"]
          subscription_id: number
        }
        Insert: {
          created_at?: string
          delivery_date: string
          id?: number
          order_id?: number | null
          status?: Database["public"]["Enums"]["schedule_status_enum"]
          subscription_id: number
        }
        Update: {
          created_at?: string
          delivery_date?: string
          id?: number
          order_id?: number | null
          status?: Database["public"]["Enums"]["schedule_status_enum"]
          subscription_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      farming_logs: {
        Row: {
          batch_id: number
          created_at: string
          description: string | null
          evidence_image_url: string | null
          id: number
          logged_at: string
          performed_by: string
          stage: Database["public"]["Enums"]["farming_stage_enum"]
          title: string
        }
        Insert: {
          batch_id: number
          created_at?: string
          description?: string | null
          evidence_image_url?: string | null
          id?: number
          logged_at?: string
          performed_by: string
          stage: Database["public"]["Enums"]["farming_stage_enum"]
          title: string
        }
        Update: {
          batch_id?: number
          created_at?: string
          description?: string | null
          evidence_image_url?: string | null
          id?: number
          logged_at?: string
          performed_by?: string
          stage?: Database["public"]["Enums"]["farming_stage_enum"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "farming_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farming_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_disposals: {
        Row: {
          batch_id: number
          created_at: string
          disposed_by: string
          id: number
          image_url: string
          note: string | null
          quantity_disposed: number
          reason: Database["public"]["Enums"]["disposal_reason_enum"]
        }
        Insert: {
          batch_id: number
          created_at?: string
          disposed_by: string
          id?: number
          image_url: string
          note?: string | null
          quantity_disposed: number
          reason: Database["public"]["Enums"]["disposal_reason_enum"]
        }
        Update: {
          batch_id?: number
          created_at?: string
          disposed_by?: string
          id?: number
          image_url?: string
          note?: string | null
          quantity_disposed?: number
          reason?: Database["public"]["Enums"]["disposal_reason_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_disposals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_disposals_disposed_by_fkey"
            columns: ["disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: number
          level: Database["public"]["Enums"]["notification_level_enum"]
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: number
          level?: Database["public"]["Enums"]["notification_level_enum"]
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: number
          level?: Database["public"]["Enums"]["notification_level_enum"]
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_details: {
        Row: {
          batch_id: number
          created_at: string
          id: number
          order_item_id: number
          quantity: number
        }
        Insert: {
          batch_id: number
          created_at?: string
          id?: number
          order_item_id: number
          quantity: number
        }
        Update: {
          batch_id?: number
          created_at?: string
          id?: number
          order_item_id?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_details_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_details_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: number
          order_id: number
          product_id: number
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: number
          order_id: number
          product_id: number
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: number
          order_id?: number
          product_id?: number
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string
          customer_name: string
          customer_note: string | null
          customer_phone: string
          delivered_at: string | null
          distance_km: number
          expected_delivery_date: string | null
          id: number
          order_number: string
          order_type: Database["public"]["Enums"]["order_type_enum"]
          shipping_address: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status_enum"]
          subscription_id: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          customer_note?: string | null
          customer_phone: string
          delivered_at?: string | null
          distance_km?: number
          expected_delivery_date?: string | null
          id?: number
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          shipping_address: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          subscription_id?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string
          delivered_at?: string | null
          distance_km?: number
          expected_delivery_date?: string | null
          id?: number
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          shipping_address?: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          subscription_id?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          gateway_response: Json | null
          id: number
          order_id: number | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_type: Database["public"]["Enums"]["payment_type_enum"]
          payos_order_code: number | null
          qr_code_url: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: number | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          gateway_response?: Json | null
          id?: number
          order_id?: number | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_type?: Database["public"]["Enums"]["payment_type_enum"]
          payos_order_code?: number | null
          qr_code_url?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: number | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          gateway_response?: Json | null
          id?: number
          order_id?: number | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_type?: Database["public"]["Enums"]["payment_type_enum"]
          payos_order_code?: number | null
          qr_code_url?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: number | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_order: number
          id: number
          image_url: string
          is_primary: boolean
          product_id: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: number
          image_url: string
          is_primary?: boolean
          product_id: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: number
          image_url?: string
          is_primary?: boolean
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: number
          is_active: boolean
          name: string
          preservation_days: number
          short_description: string | null
          slug: string
          unit: string
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          preservation_days?: number
          short_description?: string | null
          slug: string
          unit?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          preservation_days?: number
          short_description?: string | null
          slug?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      quality_certifications: {
        Row: {
          cert_name: string
          cert_number: string | null
          created_at: string
          deleted_at: string | null
          expiry_date: string | null
          file_url: string
          id: number
          issue_date: string | null
          issued_by: string | null
          product_id: number
        }
        Insert: {
          cert_name: string
          cert_number?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          file_url: string
          id?: number
          issue_date?: string | null
          issued_by?: string | null
          product_id: number
        }
        Update: {
          cert_name?: string
          cert_number?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          file_url?: string
          id?: number
          issue_date?: string | null
          issued_by?: string | null
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_certifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          deleted_at: string | null
          id: number
          order_item_id: number
          product_id: number
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: number
          order_item_id: number
          product_id: number
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: number
          order_item_id?: number
          product_id?: number
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          id: number
          product_id: number
          quantity: number
          subscription_id: number
          unit_price: number
        }
        Insert: {
          id?: number
          product_id: number
          quantity: number
          subscription_id: number
          unit_price: number
        }
        Update: {
          id?: number
          product_id?: number
          quantity?: number
          subscription_id?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string
          end_date: string
          id: number
          package_name: string
          shipping_address: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_date: string
          id?: number
          package_name: string
          shipping_address: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: number
          package_name?: string
          shipping_address?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_fefo: { Args: { p_order_id: number }; Returns: undefined }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role_enum"]
      }
    }
    Enums: {
      batch_status_enum: "growing" | "in_stock" | "sold_out"
      complaint_reason_enum:
        | "damaged"
        | "wrong_item"
        | "missing_quantity"
        | "expired_or_spoiled"
        | "late_delivery"
        | "other"
      complaint_status_enum: "pending" | "approved" | "rejected" | "resolved"
      disposal_reason_enum:
        | "damaged"
        | "rotten"
        | "expired"
        | "quality_failed"
        | "other"
      farming_stage_enum:
        | "sowing"
        | "fertilizing"
        | "watering"
        | "pest_control"
        | "harvesting"
        | "packaging"
      media_type_enum: "image" | "video"
      notification_level_enum: "info" | "warning" | "danger"
      order_status_enum:
        | "pending"
        | "confirmed"
        | "preparing"
        | "shipping"
        | "delivered"
        | "cancelled"
      order_type_enum: "retail" | "subscription" | "replacement"
      payment_method_enum: "payos" | "cod"
      payment_status_enum: "pending" | "paid" | "failed" | "refunded"
      payment_type_enum: "order_payment" | "subscription_payment" | "refund"
      resolution_enum: "refund" | "replacement"
      schedule_status_enum: "pending" | "generated" | "skipped" | "cancelled"
      subscription_status_enum:
        | "pending_payment"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      user_role_enum: "customer" | "farm_staff" | "sales" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      batch_status_enum: ["growing", "in_stock", "sold_out"],
      complaint_reason_enum: [
        "damaged",
        "wrong_item",
        "missing_quantity",
        "expired_or_spoiled",
        "late_delivery",
        "other",
      ],
      complaint_status_enum: ["pending", "approved", "rejected", "resolved"],
      disposal_reason_enum: [
        "damaged",
        "rotten",
        "expired",
        "quality_failed",
        "other",
      ],
      farming_stage_enum: [
        "sowing",
        "fertilizing",
        "watering",
        "pest_control",
        "harvesting",
        "packaging",
      ],
      media_type_enum: ["image", "video"],
      notification_level_enum: ["info", "warning", "danger"],
      order_status_enum: [
        "pending",
        "confirmed",
        "preparing",
        "shipping",
        "delivered",
        "cancelled",
      ],
      order_type_enum: ["retail", "subscription", "replacement"],
      payment_method_enum: ["payos", "cod"],
      payment_status_enum: ["pending", "paid", "failed", "refunded"],
      payment_type_enum: ["order_payment", "subscription_payment", "refund"],
      resolution_enum: ["refund", "replacement"],
      schedule_status_enum: ["pending", "generated", "skipped", "cancelled"],
      subscription_status_enum: [
        "pending_payment",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      user_role_enum: ["customer", "farm_staff", "sales", "admin"],
    },
  },
} as const
