import { supabaseAdmin } from "../config/supabaseClient";
import { AddressDTO, UpdateProfileDTO } from "../types/authTypes";
import { AppError } from "../utils/appError";

export class ProfileRepository {
  async findById(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, full_name, phone, avatar_url, role, created_at, updated_at, deleted_at",
      )
      .eq("id", userId)
      .single();

    if (error || !data) return null;
    return data;
  }

  async findByEmail(email: string) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, deleted_at")
      .eq("email", email)
      .single();

    if (error || !data) return null;
    return data;
  }

  async updateProfile(userId: string, payload: UpdateProfileDTO) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .is("deleted_at", null)
      .select("id, email, full_name, phone, avatar_url, role, updated_at")
      .single();

    if (error)
      throw new AppError("Cập nhật hồ sơ thất bại: " + error.message, 400);
    return data;
  }

  // --- QUẢN LÝ SỔ ĐỊA CHỈ (ADDRESSES) ---
  async getAddressesByUserId(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new AppError("Lỗi tải danh sách địa chỉ", 500);
    return data;
  }

  async createAddress(userId: string, payload: AddressDTO) {
    // Nếu địa chỉ mới đặt làm mặc định, reset các địa chỉ mặc định cũ của user
    if (payload.is_default) {
      await supabaseAdmin
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userId)
        .is("deleted_at", null);
    }

    const { data, error } = await supabaseAdmin
      .from("addresses")
      .insert({ ...payload, user_id: userId })
      .select("*")
      .single();

    if (error)
      throw new AppError("Thêm địa chỉ mới thất bại: " + error.message, 400);
    return data;
  }

  async updateAddress(
    userId: string,
    addressId: number,
    payload: Partial<AddressDTO>,
  ) {
    if (payload.is_default) {
      await supabaseAdmin
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userId)
        .is("deleted_at", null);
    }

    const { data, error } = await supabaseAdmin
      .from("addresses")
      .update(payload)
      .eq("id", addressId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data)
      throw new AppError("Không tìm thấy địa chỉ hoặc cập nhật thất bại", 404);
    return data;
  }

  async softDeleteAddress(userId: string, addressId: number) {
    const { data, error } = await supabaseAdmin
      .from("addresses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", addressId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error || !data)
      throw new AppError("Không tìm thấy địa chỉ để xóa", 404);
    return true;
  }
}
