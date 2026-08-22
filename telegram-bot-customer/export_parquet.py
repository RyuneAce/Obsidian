import os
import sys
import json
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

script_dir = os.path.dirname(os.path.abspath(__file__))
hacquire_dir = os.path.abspath(os.path.join(script_dir, ".."))
customers_json_path = os.path.join(script_dir, "customers.json")
parquet_output_path = os.path.join(hacquire_dir, "customer_data.parquet")
csv_output_path = os.path.join(hacquire_dir, "customer_data.csv")

def export_to_parquet():
    if not os.path.exists(customers_json_path):
        print("No customers.json found, creating empty dataset.")
        data = []
    else:
        with open(customers_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

    rows = []
    for cust in data:
        chat_id = cust.get("chatId")
        name = cust.get("name")
        username = cust.get("username", "")
        phone = cust.get("phone", "")
        customer_type = cust.get("customerType", "New Customer 🌱")
        loyalty_points = cust.get("loyaltyPoints", 0)
        location = cust.get("location", "")
        first_seen = cust.get("firstSeen", "")
        last_seen = cust.get("lastSeen", "")
        total_orders = cust.get("totalOrders", 0)
        total_spent = cust.get("totalSpent", 0)
        referral_code = cust.get("referralCode", "")
        referred_by = cust.get("referredBy", "")

        orders = cust.get("orders", [])
        if not orders:
            rows.append({
                "customer_chat_id": int(chat_id),
                "customer_name": str(name),
                "customer_username": str(username or ""),
                "customer_phone": str(phone or ""),
                "customer_type": str(customer_type),
                "loyalty_points": int(loyalty_points),
                "customer_location": str(location),
                "first_seen": str(first_seen),
                "last_seen": str(last_seen),
                "total_orders": int(total_orders),
                "total_spent": float(total_spent),
                "referral_code": str(referral_code),
                "referred_by": str(referred_by or ""),
                "order_id": "",
                "order_timestamp": "",
                "items_count": 0,
                "items_summary": "",
                "subtotal": 0.0,
                "discount": 0.0,
                "total_cost": 0.0,
                "payment_method": "",
                "delivery_partner_name": "",
                "delivery_partner_phone": "",
                "delivery_status": "",
                "shop_rating": None,
                "shop_feedback": "",
                "delivery_rating": None,
                "delivery_feedback": "",
                "order_notes": "",
                "promo_code_applied": "",
                "promo_discount": 0.0,
            })
        else:
            for ord in orders:
                items = ord.get("items", [])
                items_summary = ", ".join([f"{i.get('emoji','')} {i.get('name','')} x{i.get('quantity',1)}" for i in items])
                
                # Support both legacy single rating/feedback and new separated ratings
                shop_r = ord.get("shopRating") if ord.get("shopRating") is not None else ord.get("rating")
                shop_f = ord.get("shopFeedback") or ord.get("feedback") or ""
                deliv_r = ord.get("deliveryRating")
                deliv_f = ord.get("deliveryFeedback") or ""

                rows.append({
                    "customer_chat_id": int(chat_id),
                    "customer_name": str(name),
                    "customer_username": str(username or ""),
                    "customer_phone": str(phone or ""),
                    "customer_type": str(customer_type),
                    "loyalty_points": int(loyalty_points),
                    "customer_location": str(location or ord.get("location") or ""),
                    "first_seen": str(first_seen),
                    "last_seen": str(last_seen),
                    "total_orders": int(total_orders),
                    "total_spent": float(total_spent),
                    "referral_code": str(referral_code),
                    "referred_by": str(referred_by or ""),
                    "order_id": str(ord.get("orderId", "")),
                    "order_timestamp": str(ord.get("timestamp", "")),
                    "items_count": int(len(items)),
                    "items_summary": str(items_summary),
                    "subtotal": float(ord.get("subtotal", 0.0)),
                    "discount": float(ord.get("discount", 0.0)),
                    "total_cost": float(ord.get("totalCost", 0.0)),
                    "payment_method": str(ord.get("paymentMethod", "")),
                    "delivery_partner_name": str(ord.get("deliveryBoy", {}).get("name", "")),
                    "delivery_partner_phone": str(ord.get("deliveryBoy", {}).get("phone", "")),
                    "delivery_status": str(ord.get("deliveryStatus", "Delivered")),
                    "shop_rating": float(shop_r) if shop_r is not None else None,
                    "shop_feedback": str(shop_f),
                    "delivery_rating": float(deliv_r) if deliv_r is not None else None,
                    "delivery_feedback": str(deliv_f),
                    "order_notes": str(ord.get("orderNotes", "") or ""),
                    "promo_code_applied": str(ord.get("promoCode", "") or ""),
                    "promo_discount": float(ord.get("promoDiscount", 0) or 0),
                })

    columns = [
        "customer_chat_id", "customer_name", "customer_username", "customer_phone", "customer_type",
        "loyalty_points", "customer_location", "first_seen", "last_seen",
        "total_orders", "total_spent", "referral_code", "referred_by",
        "order_id", "order_timestamp",
        "items_count", "items_summary", "subtotal", "discount", "total_cost",
        "payment_method", "delivery_partner_name", "delivery_partner_phone",
        "delivery_status", "shop_rating", "shop_feedback", "delivery_rating", "delivery_feedback",
        "order_notes", "promo_code_applied", "promo_discount"
    ]

    if not rows:
        df = pd.DataFrame(columns=columns)
    else:
        df = pd.DataFrame(rows)

    df.to_parquet(parquet_output_path, engine="pyarrow", index=False)
    df.to_csv(csv_output_path, index=False, encoding="utf-8")
    print(f"✅ Saved customer data to Parquet ({parquet_output_path}) & CSV ({csv_output_path}) ({len(df)} rows)")

if __name__ == "__main__":
    export_to_parquet()
