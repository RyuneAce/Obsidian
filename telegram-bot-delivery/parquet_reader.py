import os
import sys
import json
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

script_dir = os.path.dirname(os.path.abspath(__file__))
hacquire_dir = os.path.abspath(os.path.join(script_dir, ".."))
parquet_path = os.path.join(hacquire_dir, "customer_data.parquet")
customers_json_path = os.path.join(hacquire_dir, "telegram-bot-customer", "customers.json")
customer_export_script = os.path.join(hacquire_dir, "telegram-bot-customer", "export_parquet.py")

def get_parquet_df():
    # If parquet doesn't exist or is empty, try running export_parquet.py
    if not os.path.exists(parquet_path):
        if os.path.exists(customer_export_script):
            import subprocess
            subprocess.run([sys.executable, customer_export_script], capture_output=True)
    
    if os.path.exists(parquet_path):
        try:
            return pd.read_parquet(parquet_path, engine="pyarrow")
        except Exception as e:
            return pd.DataFrame()
    return pd.DataFrame()

def get_agent_orders(agent_name=None):
    df = get_parquet_df()
    if df.empty:
        # Fallback to json if parquet is empty
        if os.path.exists(customers_json_path):
            with open(customers_json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            data = raw if isinstance(raw, list) else list(raw.values())
            orders = []
            for cust in data:
                for ord in cust.get("orders", []):
                    if not agent_name or ord.get("deliveryBoy", {}).get("name") == agent_name:
                        orders.append({
                            "customer_chat_id": cust.get("chatId"),
                            "customer_name": cust.get("name"),
                            "customer_username": cust.get("username", ""),
                            "customer_type": cust.get("customerType", "New Customer 🌱"),
                            "loyalty_points": cust.get("loyaltyPoints", 0),
                            "customer_location": ord.get("location") or cust.get("location", ""),
                            "total_orders": cust.get("totalOrders", 0),
                            "total_spent": cust.get("totalSpent", 0),
                            "order_id": ord.get("orderId"),
                            "order_timestamp": ord.get("timestamp"),
                            "items_count": len(ord.get("items", [])),
                            "items_summary": ", ".join([f"{i.get('emoji','')} {i.get('name','')} x{i.get('quantity',1)}" for i in ord.get("items", [])]),
                            "items": ord.get("items", []),
                            "subtotal": ord.get("subtotal", 0),
                            "discount": ord.get("discount", 0),
                            "total_cost": ord.get("totalCost", 0),
                            "payment_method": ord.get("paymentMethod", ""),
                            "delivery_partner_name": ord.get("deliveryBoy", {}).get("name", ""),
                            "delivery_partner_phone": ord.get("deliveryBoy", {}).get("phone", ""),
                            "delivery_status": ord.get("deliveryStatus", "Assigned"),
                            "shop_rating": ord.get("shopRating"),
                            "shop_feedback": ord.get("shopFeedback", ""),
                            "delivery_rating": ord.get("deliveryRating"),
                            "delivery_feedback": ord.get("deliveryFeedback", ""),
                            "order_notes": ord.get("orderNotes", ""),
                            "promo_code_applied": ord.get("promoCode", ""),
                            "promo_discount": ord.get("promoDiscount", 0)
                        })
            return orders
        return []
    
    if agent_name:
        df = df[df["delivery_partner_name"] == agent_name]
    
    # Fill NaN values
    df = df.fillna("")
    return df.to_dict(orient="records")

def get_customer_profile(customer_chat_id):
    if not customer_chat_id:
        return None

    df = get_parquet_df()
    if df.empty:
        # Fallback to json if parquet is empty
        if os.path.exists(customers_json_path):
            with open(customers_json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            data = raw if isinstance(raw, list) else list(raw.values())
            for cust in data:
                if str(cust.get("chatId")) == str(customer_chat_id):
                    return {
                        "profile": {
                            "customer_chat_id": cust.get("chatId"),
                            "customer_name": cust.get("name"),
                            "customer_username": cust.get("username", ""),
                            "customer_phone": cust.get("phone", ""),
                            "customer_type": cust.get("customerType", "New Customer 🌱"),
                            "loyalty_points": cust.get("loyaltyPoints", 0),
                            "customer_location": cust.get("location", ""),
                            "first_seen": cust.get("firstSeen", ""),
                            "last_seen": cust.get("lastSeen", ""),
                            "total_orders": cust.get("totalOrders", 0),
                            "total_spent": cust.get("totalSpent", 0)
                        },
                        "orders": cust.get("orders", [])
                    }
        return None

    try:
        cust_df = df[df["customer_chat_id"].astype(str) == str(customer_chat_id)]
    except Exception:
        cust_df = df[df["customer_chat_id"] == int(customer_chat_id)]

    if cust_df.empty:
        # Fallback to json
        if os.path.exists(customers_json_path):
            with open(customers_json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            data = raw if isinstance(raw, list) else list(raw.values())
            for cust in data:
                if str(cust.get("chatId")) == str(customer_chat_id):
                    return {
                        "profile": {
                            "customer_chat_id": cust.get("chatId"),
                            "customer_name": cust.get("name"),
                            "customer_username": cust.get("username", ""),
                            "customer_phone": cust.get("phone", ""),
                            "customer_type": cust.get("customerType", "New Customer 🌱"),
                            "loyalty_points": cust.get("loyaltyPoints", 0),
                            "customer_location": cust.get("location", ""),
                            "first_seen": cust.get("firstSeen", ""),
                            "last_seen": cust.get("lastSeen", ""),
                            "total_orders": cust.get("totalOrders", 0),
                            "total_spent": cust.get("totalSpent", 0)
                        },
                        "orders": cust.get("orders", [])
                    }
        return None

    # Crucial: Replace NaN values with empty string so Python outputs standard JSON without NaN tokens
    cust_df = cust_df.fillna("")
    first_row = cust_df.iloc[0].to_dict()
    orders_list = cust_df.to_dict(orient="records")
    return {
        "profile": {
            "customer_chat_id": first_row.get("customer_chat_id"),
            "customer_name": first_row.get("customer_name"),
            "customer_username": first_row.get("customer_username"),
            "customer_phone": first_row.get("customer_phone", ""),
            "customer_type": first_row.get("customer_type"),
            "loyalty_points": first_row.get("loyalty_points"),
            "customer_location": first_row.get("customer_location"),
            "first_seen": first_row.get("first_seen"),
            "last_seen": first_row.get("last_seen"),
            "total_orders": first_row.get("total_orders"),
            "total_spent": first_row.get("total_spent")
        },
        "orders": orders_list
    }

def update_status(order_id, new_status):
    # Update in customers.json and sync to parquet
    if os.path.exists(customers_json_path):
        with open(customers_json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        data = raw if isinstance(raw, list) else list(raw.values())
        updated = False
        for cust in data:
            for ord in cust.get("orders", []):
                if ord.get("orderId") == order_id:
                    ord["deliveryStatus"] = new_status
                    updated = True
                    break
        if updated:
            with open(customers_json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            # Resync parquet
            if os.path.exists(customer_export_script):
                import subprocess
                subprocess.run([sys.executable, customer_export_script], capture_output=True)
            return True
    return False

def claim_order(order_id, agent_name, agent_phone):
    if os.path.exists(customers_json_path):
        with open(customers_json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        data = raw if isinstance(raw, list) else list(raw.values())
        for cust in data:
            for ord in cust.get("orders", []):
                if ord.get("orderId") == order_id:
                    existing_boy = ord.get("deliveryBoy", {}).get("name")
                    if existing_boy and existing_boy != agent_name and ord.get("deliveryStatus") not in ["Pending Claim ⏳", "Unassigned"]:
                        return {"success": False, "error": f"Already claimed by {existing_boy}"}
                    ord["deliveryBoy"] = {"name": agent_name, "phone": agent_phone}
                    ord["deliveryStatus"] = "Assigned"
                    with open(customers_json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    if os.path.exists(customer_export_script):
                        import subprocess
                        subprocess.run([sys.executable, customer_export_script], capture_output=True)
                    return {
                        "success": True,
                        "customer_chat_id": cust.get("chatId"),
                        "customer_name": cust.get("name"),
                        "order": ord
                    }
    return {"success": False, "error": "Order not found"}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        action = sys.argv[1]
        if action == "orders":
            agent = sys.argv[2] if len(sys.argv) > 2 else None
            print(json.dumps(get_agent_orders(agent)))
        elif action == "profile":
            chat_id = sys.argv[2] if len(sys.argv) > 2 else ""
            print(json.dumps(get_customer_profile(chat_id)))
        elif action == "update_status":
            oid = sys.argv[2]
            stat = sys.argv[3]
            success = update_status(oid, stat)
            print(json.dumps({"success": success}))
        elif action == "claim":
            oid = sys.argv[2]
            aname = sys.argv[3]
            aphone = sys.argv[4] if len(sys.argv) > 4 else ""
            res = claim_order(oid, aname, aphone)
            print(json.dumps(res))
        else:
            print(json.dumps(get_agent_orders()))
    else:
        print(json.dumps(get_agent_orders()))

