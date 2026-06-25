import { useState, useEffect, useRef} from "react";

export default function POS({ goBack, editingOrder }) {

  

  const [sku, setSku] = useState("");
  const [cart, setCart] = useState([]);

  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [received, setReceived] = useState(0);

  const [products, setProducts] = useState([]);


  const [heldOrders, setHeldOrders] = useState([]);

  const [currentTime, setCurrentTime] = useState(new Date());

  const paymentRef = useRef(null);
  const skuRef = useRef(null);

  const [enterCount, setEnterCount] = useState(0);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Enter") {
        setEnterCount(prev => {
          const next = prev + 1;
  
          if (next === 3) {
            paymentRef.current?.focus(); // ✅ focus input
            return 0; // reset
          }
  
          return next;
        });
      } else {
        // reset if other key pressed
        setEnterCount(0);
      }
    }
  
    window.addEventListener("keydown", handleKey);
  
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (enterCount === 0) return;
  
    const timer = setTimeout(() => {
      setEnterCount(0);
    }, 1000);
  
    return () => clearTimeout(timer);
  }, [enterCount]);

  useEffect(() => {
    function handleKey(e) {
  
      // 🔥 F2 → focus SKU
      if (e.key === "F2") {
        e.preventDefault();
        skuRef.current?.focus();
      }
  
      // 🔥 F4 → submit / update order
      if (e.key === "F4") {
        e.preventDefault();
        if (editingOrder) {
          saveOrder();
        } else {
          submitOrder();
        }
      }
  
      // 🔥 ESC → clear cart
      if (e.key === "Escape") {
        e.preventDefault();
  
        const confirmClear = window.confirm("Clear current cart?");
        if (!confirmClear) return;
  
        setCart([]);
        setCustomer({ name: "", phone: "" });
        setDiscountPercent(0);
        setDiscountFixed(0);
        setTaxPercent(0);
        setReceived(0);
      }
    }
  
    window.addEventListener("keydown", handleKey);
  
    return () => window.removeEventListener("keydown", handleKey);
  }, [cart, editingOrder]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // update every second
  
    return () => clearInterval(interval);
  }, []);

  

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (editingOrder && products.length > 0) {
      loadOrderIntoCart(editingOrder);
  
      setCustomer({
        name: editingOrder.customer_name || "",
        phone: editingOrder.customer_phone || ""
      });
  
      const percent = Number(editingOrder.discount_percent) || 0;
      const fixed = Number(editingOrder.discount) || 0;
  
      if (percent > 0 && fixed > 0) {
        setDiscountPercent(percent);
        setDiscountFixed(fixed);
      } else if (percent > 0) {
        setDiscountPercent(percent);
        setDiscountFixed(0);
      } else {
        setDiscountPercent(0);
        setDiscountFixed(fixed);
      }
  
      setTaxPercent(Number(editingOrder.tax_percent) || 0);
      setReceived(Number(editingOrder.received) || 0);
    }
  }, [editingOrder, products]); // 🔥 IMPORTANT

  useEffect(() => {
    if (!editingOrder) {
      setCart([]);
      setCustomer({ name: "", phone: "" });
      setDiscountPercent(0);
      setDiscountFixed(0);
      setTaxPercent(0);
      setReceived(0);
    }
  }, [editingOrder]);

  function loadOrderIntoCart(order) {
    const items = order.items || [];
  
    const formatted = items.map(item => {
      const product = products.find(p => p.sku === item.sku);
    
      return {
        id: item.sku,
        sku: item.sku,
        name: item.product_name,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
        unit: product?.unit || "",
        stock: product?.stock || 0, // ✅ always correct stock
        itemDiscountPercent: Number(item.discount_percent) || 0,
        itemDiscountFixed: Number(item.discount_fixed) || 0
      };
    });
  
    setCart(formatted);
  }

  async function loadProducts() {
    const data = await window.electron?.invoke("get-products");
    console.log("ALL PRODUCTS:", data); // 🔥 DEBUG
    // alert(data);
    setProducts(data);
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await window.electron.invoke("sync-products", {
        user_id: user.id
      });
      loadProducts(); // 🔥 refresh UI
    }, 5 * 60 * 1000);
  
    return () => clearInterval(interval);
  }, []);

  async function addBySKU() { 
    if (!sku) return;
    const product = await window.electron?.invoke(
        "get-product-by-code",
        sku.trim()
      );
    if (!product) return alert("Product not found");
    addToCart(product);
    setSku("");
  }


  function wordsToNumber(text) {
    const numbers = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      sixty: 60,
      seventy: 70,
      eighty: 80,
      ninety: 90
    };
  
    text = text
      .replace(/rupees?|rs\.?/gi, "")
      .trim();
  
    // If user already said digits
    if (/\d/.test(text)) {
      return parseInt(text.replace(/[^\d]/g, ""), 10);
    }
  
    const words = text.split(/\s+/);
  
    let total = 0;
    let current = 0;
  
    for (const word of words) {
      if (numbers[word] !== undefined) {
        current += numbers[word];
      } else if (word === "hundred") {
        current *= 100;
      } else if (word === "thousand") {
        total += current * 1000;
        current = 0;
      } else if (word === "lakh") {
        total += current * 100000;
        current = 0;
      }
    }
  
    return total + current;
  }

  function startVoiceRecognition() { 
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
  
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported on this device");
      return;
    }
  
    const recognition = new SpeechRecognition();
  
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
  
    recognition.onstart = () => {
      console.log("🎤 Listening...");
    };

    // recognition.onend = () => {
    //   recognition.start();
    // };
  
    recognition.onerror = (e) => {
      console.log("Speech Error Object:", e);
    
      alert(JSON.stringify({
        error: e.error,
        message: e.message
      }));
    };
  
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript
        .toLowerCase()
        .trim();
  
      console.log("Voice Command:", text);
  
      /*
      ==========================
      SUBMIT ORDER
      ==========================
      */
  
      if (
        text.includes("submit order") ||
        text.includes("complete order")
      ) {
        submitOrder();
        return;
      }
  
      /*
      ==========================
      HOLD ORDER
      ==========================
      */
  
      if (
        text.includes("hold order") ||
        text.includes("hold this order")
      ) {
        holdOrder();
        return;
      }
  
      /*
      ==========================
      CLEAR CART
      ==========================
      */
  
      if (
        text.includes("clear cart") ||
        text.includes("empty cart")
      ) {
        setCart([]);
        return;
      }
  
      /*
      ==========================
      ADD SKU
      ==========================
      */
  
      if (
        text.includes("sku") ||
        text.includes("product") ||
        text.includes("item")
      ) {
        const numberWords = {
          zero: "0",
          one: "1",
          two: "2",
          three: "3",
          four: "4",
          five: "5",
          six: "6",
          seven: "7",
          eight: "8",
          nine: "9"
        };
  
        const afterSku = text
  .replace("add sku", "")
  .replace("sku", "")
  .replace("add product", "")
  .replace("product", "")
  .replace("add item", "")
  .replace("item", "")
  .trim();

        if (!afterSku) {
          alert("Please say a SKU");
          return;
        }
  
        let sku = "";
  
        afterSku
          .trim()
          .split(/\s+/)
          .forEach(word => {
            if (numberWords[word] !== undefined) {
              sku += numberWords[word];
            } else if (/^\d+$/.test(word)) {
              sku += word;
            }
          });
  
        if (sku) {
          console.log("SKU:", sku);
  
          const product = await window.electron.invoke(
            "get-product-by-sku",
            sku
          );
  
          if (!product) {
            alert(`Product not found: ${sku}`);
            return;
          }
  
          addToCart(product);
  
          window.speechSynthesis.speak(
            new SpeechSynthesisUtterance(
              `${product.name} added`
            )
          );
  
          return;
        }
      }
  
      /*
      ==========================
      AMOUNT RECEIVED
      ==========================
      */
  
      if (
        text.includes("amount received") ||
        text.includes("receive amount") ||
        text.includes("received amount")
      ) {

        const amountText = text
  .replace("amount received", "")
  .replace("receive amount", "")
  .replace("received amount", "")
  .trim();
      
        const amount = wordsToNumber(amountText);
      
        if (amount > 0) {
      
          console.log("Received Amount:", amount);
      
          setCollectedAmount(amount);
      
          window.speechSynthesis.speak(
            new SpeechSynthesisUtterance(
              `Received ${amount} rupees`
            )
          );
      
          return;
        }
      }
  
      alert("Command not recognized");
    };
  
    recognition.start();
  }

  function addToCart(product, qty = 1) {
    setCart(prev => {
      const existing = prev.find(p => p.sku === product.sku);
  
      if (existing) {
        const updated = prev.map(p =>
          p.sku === product.sku
            ? { ...p, qty: p.qty + qty }
            : p
        );
  
        // 🔥 move updated item to top
        const item = updated.find(p => p.sku === product.sku);
        const others = updated.filter(p => p.sku !== product.sku);
  
        return [item, ...others];
      }
  
      // 🔥 new item goes on top
      return [
        { 
          ...product, 
          qty, 
          itemDiscountPercent: Number(product.discount_percent) || 0,
  itemDiscountFixed: Number(product.discount_fixed) || 0,
          stock: product.stock || 0,
          unit: product.unit || "" // ✅ ADD THIS
        },
        ...prev
      ];
    });
  }

  function updateQty(id, qty) {
    if (qty < 0) return;
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  }

  function updateItemDiscount(id, field, value) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, [field]: Number(value) } : i));
  }

  function removeItem(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  

  function getItemTotal(item) {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
  
    const base = price * qty;
    const percent = (base * (Number(item.itemDiscountPercent) || 0)) / 100;
    const fixed = Number(item.itemDiscountFixed) || 0;
  
    return base - (percent + fixed);
  }

  // 🔥 CALCULATIONS
  const subtotal = cart.reduce((sum, i) => sum + getItemTotal(i), 0);

  const billDiscount = (subtotal * discountPercent) / 100 + discountFixed;

  const afterDiscount = subtotal - billDiscount;

  const taxAmount = (afterDiscount * taxPercent) / 100;

  const netTotal = afterDiscount + taxAmount;

  const change = received > netTotal ? received - netTotal : 0;

  async function submitOrder() {
    if (cart.length === 0) return alert("Cart is empty");

    // ✅ NEW VALIDATION
    if (received <= 0) {
      return alert("Please enter received amount");
    }

    // ✅ Optional (better): prevent underpayment
    if (received < netTotal) {
      return alert("Received amount is less than total bill");
    }

    const storeId = localStorage.getItem("store_id");
const user = JSON.parse(localStorage.getItem("user") || "{}");
  
    const order = {
      items: cart,
      total: netTotal,
      tax: taxAmount,
      discount: discountFixed,
  
      discountPercent,
      taxPercent,
      received,
      change,
  
      customer,
      store_id: storeId,   // ✅
  user_id: user.id     // ✅ ADD THIS
    };
  
    await window.electron.invoke("save-order", order);
  
    await loadProducts(); // ✅ refresh stock
    const html = generateBillHTML(order, user);
    await window.electron.invoke("print-bill", html);
  
    // 🔥 RESET EVERYTHING
    setCart([]);
    setReceived(0);
    setDiscountPercent(0);
    setDiscountFixed(0);
    setTaxPercent(0);
    setCustomer({ name: "", phone: "" });
  }

  async function saveOrder() {
    if (cart.length === 0) return alert("Cart is empty");

    const storeId = localStorage.getItem("store_id");
const user = JSON.parse(localStorage.getItem("user") || "{}");
  
    const order = {
      id: editingOrder.id,
      items: cart,
      total: netTotal,
      tax: taxAmount,
      discount: discountFixed,
    
      discountPercent, // 🔥 ADD
      taxPercent,      // 🔥 ADD
    
      customer,
      received,
      change,
      store_id: storeId,   // ✅
  user_id: user.id     // ✅ ADD
    };
  
    // 🔥 update order (same as submit)
    await window.electron.invoke("update-order-full", order);

    await loadProducts(); // ✅ refresh stock
  
    // 🔥 print updated bill
    const html = generateBillHTML(order, user);
    await window.electron.invoke("print-bill", html);
  
    // 🔥 clear + go back
    setCart([]);
    goBack("orders");
  }

  function holdOrder() {
    if (cart.length === 0) return;
  
    const held = {
      id: Date.now(),
      cart,
      customer,
      discountPercent,
      discountFixed,
      taxPercent,
      received
    };
  
    setHeldOrders(prev => [held, ...prev]);
  
    // 🔥 clear current POS
    setCart([]);
    setCustomer({ name: "", phone: "" });
    setDiscountPercent(0);
    setDiscountFixed(0);
    setTaxPercent(0);
    setReceived(0);
  }

  function loadHeld(order) {
    setCart(order.cart);
    setCustomer(order.customer);
    setDiscountPercent(order.discountPercent);
    setDiscountFixed(order.discountFixed);
    setTaxPercent(order.taxPercent);
    setReceived(order.received);
    // remove from held list
    setHeldOrders(prev => prev.filter(o => o.id !== order.id));
  }


//   AUTO BACKGROUND SYNC
  useEffect(() => {
    const interval = setInterval(() => {
      window.electron.invoke("sync-orders");
    }, 10000); // every 10 sec
  
    return () => clearInterval(interval);
  }, []);

  function generateBillHTML(order, user) {

    return `
    <html>
      <head>
        <style>
  @page {
    size: 72mm auto;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 72mm;
    font-family: monospace;
    font-size: 12px;
  }

  body {
    padding: 4px;
    box-sizing: border-box;
  }

  .center {
    text-align: center;
  }

  .logo {
    width: 60px;
    margin: 0 auto;
    display: block;
  }

  .line {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    width: 100%;
  }

  .bold {
    font-weight: bold;
  }

  .total {
    font-size: 20px;
    font-weight: bold;
  }

  .small {
    font-size: 11px;
  }
</style>
      </head>
  
      <body>
  
        <!-- LOGO -->
        <div class="center">
          <img src="${user?.avatar}" class="logo" />
          <h3>${user?.name}</h3>
          <div class="small">${new Date().toLocaleString()}</div>
        </div>
  
        <div class="line"></div>
  
        <!-- ITEMS -->
        ${order.items.map(i => {
          const base = i.price * i.qty;
          const percent = (base * (i.itemDiscountPercent || 0)) / 100;
          const total = base - (percent + (i.itemDiscountFixed || 0));
  
          return `
            <div class="row bold">
              <span>${i.name}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div class="row small">
              <span>${i.qty} x ${i.price}</span>
              <span>${i.itemDiscountPercent || 0}% + ${i.itemDiscountFixed || 0}</span>
            </div>
          `;
        }).join("")}
  
        <div class="line"></div>
  
        <!-- SUMMARY -->
        <div class="row">
          <span>Subtotal</span>
          <span>${order.items.reduce((sum, i) => {
            const base = i.price * i.qty;
            const percent = (base * (i.itemDiscountPercent || 0)) / 100;
            return sum + (base - (percent + (i.itemDiscountFixed || 0)));
          }, 0).toFixed(2)}</span>
        </div>
  
        <div class="row">
          <span>Discount</span>
          <span>${order.discount.toFixed(2)}</span>
        </div>
  
        <div class="row">
          <span>Tax</span>
          <span>${order.tax.toFixed(2)}</span>
        </div>
  
        <div class="line"></div>
  
        <div class="row total">
          <span>NET TOTAL</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
  
        <div class="line"></div>
  
        <!-- PAYMENT -->
        <div class="row">
          <span>Received</span>
          <span>${order.received?.toFixed(2) || 0}</span>
        </div>
  
        <div class="row">
          <span>Change</span>
          <span>${order.change?.toFixed(2) || 0}</span>
        </div>
  
        <div class="line"></div>
  
        <!-- FOOTER -->
        <div class="center small">
          <p>📞 ${user?.phone_1}</p>
          <p>${user?.tag_line}</p>
          <p>Visit again 😊</p>
        </div>
  
      </body>
    </html>
    `;
  }

  return (
    <div style={styles.container}>


      {/* LEFT PANEL */}
      <div style={styles.left}>


{editingOrder && (
  <div style={{
    background: "#ff9800",
    color: "#fff",
    padding: 10,
    textAlign: "center",
    fontWeight: "bold"
  }}>
    Editing Order #{editingOrder.id}
  </div>
)}

        {/* TOP BAR */}
        <div style={styles.topBar}>
  <button onClick={goBack} style={styles.back}>←</button>

  <div style={styles.scanWrap}>

  <div style={{ display: "flex", gap: 10 }}>

    <input
      ref={skuRef}
      autoFocus
      placeholder="Scan barcode or SKU..."
      value={sku}
      onChange={(e) => setSku(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && addBySKU()}
      style={styles.scan}
    />

    {/* <button
        onClick={startVoiceRecognition}
        style={{
          width: 60,
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 22
        }}
      >
        🎤
      </button> */}
  </div>

    <div style={styles.shortcutsWrap}>
      <span style={styles.key}>F2</span> Scan
      <span style={styles.key}>F4</span> Submit
      <span style={styles.key}>ESC</span> Clear
      <span style={styles.key}>⏎×3</span> Pay
    </div>
  </div>
</div>

        {/* CUSTOMER */}
        <div style={{ ...styles.customer, alignItems: "center" }}>
          <input style={styles.customer_input} placeholder="Customer Name" value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          
            <input
  style={styles.customer_input}
  placeholder="Phone"
  value={customer.phone}
  onChange={(e) =>
    setCustomer({ ...customer, phone: e.target.value })
  }
/>

<div style={{ fontSize: 14, color: "#555", padding: "10px" }}>
  {currentTime.toLocaleString()}
</div>
        </div>

        {/* TABLE HEADER */}
        <div style={styles.tableHeader}>
  <div style={styles.colItem}>Item</div>
  <div style={styles.colQty}>Qty</div>
  <div style={styles.colStock}>Stock</div> {/* NEW */}
  <div style={styles.colRate}>Rate</div>
  <div style={styles.colPercent}>%</div>
  <div style={styles.colDisc}>Disc</div>
  <div style={styles.colTotal}>Total</div>
  <div style={styles.colAction}></div>
</div>

        {/* CART */}
        <div style={styles.cart}>
          {cart.map(item => (
            <div key={item.id} style={styles.row}>

<div style={styles.colItem}>
  <div style={{ fontWeight: "500" }}>{item.name}</div>
  <div style={{ fontSize: 12, color: "#888" }}>{item.sku}</div>
  <div style={{ fontSize: 12, color: "#888" }}>{item.product_bar_code}</div>

  
</div>

<div style={styles.colQty}>
              <input type="number" value={item.qty}
                onChange={(e) => updateQty(item.id, Number(e.target.value))}
                style={styles.cellInput} />
</div>
<div style={styles.colStock}>
  {item.stock ?? 0}
</div>
<div style={styles.colRate}>
  <div>{item.price}</div>
  <div style={{ fontSize: 12, color: "#888" }}>
    {item.unit ? `per ${item.unit}` : ""}
  </div>
</div>
              <div style={styles.colPercent}>
              <input type="number" value={item.itemDiscountPercent}
                onChange={(e) => updateItemDiscount(item.id, "itemDiscountPercent", e.target.value)}
                style={styles.cellInput} />
</div>
<div style={styles.colDisc}>
              <input type="number" value={item.itemDiscountFixed}
                onChange={(e) => updateItemDiscount(item.id, "itemDiscountFixed", e.target.value)}
                style={styles.cellInput} />
</div>
<div style={styles.colTotal}>{getItemTotal(item).toFixed(2)}</div>
<div style={styles.colAction}>
              <button onClick={() => removeItem(item.id)} style={styles.removeBtn}>✕</button>
</div>
            </div>
          ))}
        </div>

      </div>

      {/* RIGHT PANEL */}
      <div style={styles.right}>

        <div>
          <h3>Bill Summary</h3>

          <div style={styles.summaryRow}><span>Items</span><span>{cart.length}</span></div>
          <div style={styles.summaryRow}><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>

          {/* Discount */}
          <div style={styles.summaryRow}>
            <span>Disc %</span>
            <input type="number" value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              style={styles.smallInput} />
          </div>

          <div style={styles.summaryRow}>
            <span>Disc</span>
            <input type="number" value={discountFixed}
              onChange={(e) => setDiscountFixed(Number(e.target.value))}
              style={styles.smallInput} />
          </div>

          <div style={styles.summaryRow}><span>Total Discount</span><span>{billDiscount.toFixed(2)}</span></div>

          {/* Tax */}
          <div style={styles.summaryRow}>
            <span>Tax %</span>
            <input type="number" value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              style={styles.smallInput} />
          </div>

          <div style={styles.summaryRow}><span>Tax</span><span>{taxAmount.toFixed(2)}</span></div>

          <div style={styles.netBox}>
            NET BILL
            <div style={styles.net}>{netTotal.toFixed(2)}</div>
          </div>
        </div>

        <div>
        <input
  ref={paymentRef} // ✅ ADD THIS
  type="number"
  placeholder="Received"
  value={received}
  onChange={(e) => setReceived(Number(e.target.value))}
  style={styles.paymentInput}
/>

          <div style={styles.summaryRow}><span>Change</span><span>{change > 0 ? change.toFixed(2) : 0}</span></div>
        </div>

        <button
  onClick={editingOrder ? saveOrder : submitOrder}
  style={styles.submitBtn}
>
  {editingOrder ? "💾 Update Order" : "Submit Order"}
</button>

<button onClick={holdOrder}>📦 Hold</button>

<h4>Held Orders</h4>

{heldOrders.map(order => (
  <div key={order.id} style={{ marginBottom: 10 }}>
    <button onClick={() => loadHeld(order)}>
      Resume ({order.cart.length} items)
    </button>
  </div>
))}

      </div>
    </div>
  );
}
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "Inter, system-ui, Arial",
    background: "#eef2f7"
  },

  left: {
    flex: 3,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12
  },

  right: {
    flex: 1,
    padding: 20,
    background: "linear-gradient(180deg, #1e1e2f, #2c2c44)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20
  },

  /* TOP BAR */
  topBar: {
    display: "flex",
    gap: 10
  },

  back: {
    background: "#333",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: 8,
    cursor: "pointer"
  },

  scan: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 16,
    outline: "none"
  },

  /* CUSTOMER */
  customer: {
    display: "flex",
    gap: 10,
    background: "#fff",
    padding: 12,
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
  },

  customer_input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ddd",
    outline: "none"
  },

  /* TABLE */
  tableHeader: {
    display: "flex",
    background: "#f1f3f6",
    padding: 12,
    fontWeight: "600",
    borderRadius: 10,
    color: "#555",
    fontSize: 14
  },

  cart: {
    flex: 1,
    overflowY: "auto",
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
  },

  row: {
    display: "flex",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid #f0f0f0",
    transition: "0.2s"
  },

  /* INPUTS */
  cellInput: {
    width: 60,
    padding: 6,
    borderRadius: 6,
    border: "1px solid #ddd",
    textAlign: "center"
  },

  /* COLUMNS */
  colItem: { flex: 3 },
  colQty: { width: 70 },
  colStock: { width: 70, textAlign: "center", color: "#777" },
  colRate: { width: 80, textAlign: "center" },
  colPercent: { width: 70 },
  colDisc: { width: 80 },
  colTotal: {
    width: 100,
    textAlign: "right",
    fontWeight: "bold",
    color: "#2c7be5"
  },
  colAction: { width: 50, textAlign: "center" },

  /* BUTTONS */
  removeBtn: {
    background: "#ff4d4f",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer"
  },

  submitBtn: {
    marginTop: 20,
    width: "100%",
    padding: 16,
    background: "linear-gradient(135deg, #2ecc71, #27ae60)",
    color: "#fff",
    border: "none",
    fontSize: 16,
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold"
  },

  /* RIGHT PANEL */
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 12,
    alignItems: "center",
    fontSize: 14
  },

  smallInput: {
    width: 60,
    padding: 6,
    borderRadius: 6,
    border: "none",
    textAlign: "center"
  },

  netBox: {
    marginTop: 20,
    padding: 20,
    background: "linear-gradient(135deg, #00c6ff, #0072ff)",
    borderRadius: 12,
    textAlign: "center",
    fontWeight: "bold"
  },

  net: {
    fontSize: 32,
    marginTop: 5
  },

  paymentInput: {
    width: "100%",
    padding: 12,
    marginTop: 20,
    borderRadius: 10,
    border: "none",
    outline: "none",
    boxSizing: "border-box" // ✅ FIX
  },
  topBar: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start" // 🔥 FIX alignment
  },
  
  scanWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  
  scan: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box"
  },
  
  shortcutsWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 6,
    fontSize: 12,
    color: "#666"
  },
  
  key: {
    background: "#eee",
    borderRadius: 6,
    padding: "2px 6px",
    fontWeight: "bold",
    fontSize: 11
  }
};