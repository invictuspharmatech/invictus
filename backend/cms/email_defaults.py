DEFAULT_TEMPLATES = [
    {
        "event_key": "order_placed",
        "name": "Order placed",
        "description": "Sent when a customer completes checkout.",
        "subject": "Order {{order_number}} received",
        "body": """<p>Hi {{customer_name}},</p>
<p>Thank you for your order <strong>{{order_number}}</strong>.</p>
<p>Items: {{items}}<br>Merchandise: ${{merchandise_total}}<br>Shipping: ${{shipping_total}}<br>Total: ${{grand_total}}</p>
<p>Ship to: {{shipping_address}}</p>
<p>Warehouse: {{warehouse}}</p>
<p>— {{site_name}}</p>""",
        "notify_admin": True,
        "notify_user": True,
        "notify_warehouse_manager": True,
        "sort_order": 10,
    },
    {
        "event_key": "order_processing",
        "name": "Order processing",
        "description": "Sent when an order is moved to processing.",
        "subject": "Order {{order_number}} is being processed",
        "body": """<p>Hi {{customer_name}},</p>
<p>Your order <strong>{{order_number}}</strong> is now being processed.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": True,
        "sort_order": 20,
    },
    {
        "event_key": "order_shipped",
        "name": "Order shipped",
        "description": "Sent when an order ships.",
        "subject": "Order {{order_number}} has shipped",
        "body": """<p>Hi {{customer_name}},</p>
<p>Your order <strong>{{order_number}}</strong> has shipped from {{warehouse}}.</p>
<p>Items: {{items}}</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": True,
        "sort_order": 30,
    },
    {
        "event_key": "order_delivered",
        "name": "Order delivered",
        "description": "Sent when an order is marked delivered.",
        "subject": "Order {{order_number}} delivered",
        "body": """<p>Hi {{customer_name}},</p>
<p>Your order <strong>{{order_number}}</strong> has been marked delivered.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 40,
    },
    {
        "event_key": "order_cancelled",
        "name": "Order cancelled",
        "description": "Sent when an order is cancelled.",
        "subject": "Order {{order_number}} cancelled",
        "body": """<p>Hi {{customer_name}},</p>
<p>Your order <strong>{{order_number}}</strong> has been cancelled.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": True,
        "notify_user": True,
        "notify_warehouse_manager": True,
        "sort_order": 50,
    },
    {
        "event_key": "contact_received",
        "name": "Contact form",
        "description": "Sent when someone submits the contact page.",
        "subject": "Contact: {{subject}}",
        "body": """<p>From: {{user_name}} ({{user_email}})</p>
<p>Subject: {{subject}}</p>
<p>{{message}}</p>""",
        "notify_admin": True,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 60,
    },
    {
        "event_key": "account_registered",
        "name": "Account registered",
        "description": "Sent when a customer creates an account.",
        "subject": "Welcome to {{site_name}}",
        "body": """<p>Hi {{user_name}},</p>
<p>Your account is ready. You can sign in with {{user_email}}.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 70,
    },
    {
        "event_key": "affiliate_applied",
        "name": "Affiliate application",
        "description": "Sent when a customer applies to the affiliate program.",
        "subject": "Affiliate application from {{user_name}}",
        "body": """<p>{{user_name}} ({{user_email}}) applied to the affiliate program.</p>""",
        "notify_admin": True,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 80,
    },
    {
        "event_key": "affiliate_approved",
        "name": "Affiliate approved",
        "description": "Sent when an affiliate application is approved.",
        "subject": "Your {{site_name}} affiliate application was approved",
        "body": """<p>Hi {{user_name}},</p>
<p>Your affiliate application was approved. Your code is <strong>{{affiliate_code}}</strong>.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 90,
    },
    {
        "event_key": "affiliate_declined",
        "name": "Affiliate declined",
        "description": "Sent when an affiliate application is declined.",
        "subject": "Update on your {{site_name}} affiliate application",
        "body": """<p>Hi {{user_name}},</p>
<p>Your affiliate application was not approved at this time.</p>
<p>— {{site_name}}</p>""",
        "notify_admin": False,
        "notify_user": True,
        "notify_warehouse_manager": False,
        "sort_order": 100,
    },
]
