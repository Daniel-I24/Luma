/**
 * MenuItem — mirrors the public.menu_items table row.
 * `price_cop` is a whole number of Colombian pesos (never decimals).
 */
export interface MenuItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_cop: number;
  image_url: string | null;
  /** Menu section the item is listed under (e.g. "Bebidas"). */
  section: string | null;
  sort_order: number;
  is_available: boolean;
  created_at: string;
}
