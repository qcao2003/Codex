const walletAddress = "0xeB595173c6199905AcE3ECE801207ab743C7b76f";
const adminPassword = "admin123";
const LOGIN_KEY = "codex-admin-auth";

const productForm = document.getElementById("productForm");
const inventoryList = document.getElementById("inventoryList");
const storefront = document.getElementById("storefront");
const inventoryTemplate = document.getElementById("inventoryItemTemplate");
const productTemplate = document.getElementById("productCardTemplate");
const copyWallet = document.getElementById("copyWallet");
const modal = document.getElementById("purchaseModal");
const modalWallet = document.getElementById("modalWallet");
const modalProduct = document.getElementById("modalProduct");
const closeModal = document.getElementById("closeModal");
const formSubmit = document.getElementById("formSubmit");
const formCancel = document.getElementById("formCancel");
const loginModal = document.getElementById("adminLogin");
const loginForm = document.getElementById("loginForm");
const walletQr = document.getElementById("walletQr");
const modalQr = document.getElementById("modalQr");

let editingId = null;

const formatPrice = (price) => `${Number(price).toFixed(2)} USDC`;
const formatStock = (stock) => `库存 ${Number(stock)}`;
const formatSales = (sales) => `已售 ${Number(sales || 0)}`;

const qrUrl = (text) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    text
  )}`;

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "请求失败");
  }
  return response.json();
};

const getProducts = () => requestJson("/api/products");

const createProduct = (payload) =>
  requestJson("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });

const updateProduct = (id, payload) =>
  requestJson(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

const deleteProduct = (id) =>
  requestJson(`/api/products/${id}`, {
    method: "DELETE",
  });

const createPurchase = (payload) =>
  requestJson("/api/purchases", {
    method: "POST",
    body: JSON.stringify(payload),
  });

const setFormMode = ({ isEditing, product }) => {
  if (!productForm) return;
  if (isEditing && product) {
    productForm.name.value = product.name;
    productForm.price.value = product.price;
    productForm.stock.value = product.stock;
    productForm.image.value = product.image || "";
    productForm.description.value = product.description || "";
    formSubmit.textContent = "保存修改";
    formCancel.hidden = false;
    editingId = product.id;
    return;
  }

  productForm.reset();
  formSubmit.textContent = "添加商品";
  formCancel.hidden = true;
  editingId = null;
};

const renderInventory = (products) => {
  if (!inventoryList || !inventoryTemplate) return;
  inventoryList.innerHTML = "";
  if (!products.length) {
    inventoryList.innerHTML = "<p class=\"item-desc\">暂无商品，请先添加。</p>";
    return;
  }

  products.forEach((product) => {
    const node = inventoryTemplate.content.cloneNode(true);
    const item = node.querySelector(".inventory-item");
    const name = node.querySelector(".item-name");
    const meta = node.querySelector(".item-meta");
    const desc = node.querySelector(".item-desc");
    const toggle = node.querySelector(".toggle");
    const edit = node.querySelector(".edit");
    const remove = node.querySelector(".remove");

    name.textContent = product.name;
    meta.textContent = `${formatPrice(product.price)} · ${formatStock(product.stock)} · ${formatSales(product.sales)}`;
    desc.textContent = product.description || "暂无描述";

    toggle.textContent = product.published ? "下架" : "上架";
    toggle.addEventListener("click", () => togglePublish(product));
    edit.addEventListener("click", () => setFormMode({ isEditing: true, product }));
    remove.addEventListener("click", () => removeProduct(product.id));

    item.classList.toggle("published", product.published);
    inventoryList.appendChild(node);
  });
};

const renderStorefront = (products) => {
  if (!storefront || !productTemplate) return;
  storefront.innerHTML = "";
  const published = products.filter((product) => product.published);
  if (!published.length) {
    storefront.innerHTML =
      "<p class=\"item-desc\">暂无上架商品，请稍后再来。</p>";
    return;
  }

  published.forEach((product) => {
    const node = productTemplate.content.cloneNode(true);
    const card = node.querySelector(".product-card");
    const image = node.querySelector(".product-image");
    const name = node.querySelector(".product-name");
    const desc = node.querySelector(".product-desc");
    const price = node.querySelector(".price");
    const stock = node.querySelector(".stock");
    const buy = node.querySelector(".buy");

    image.src =
      product.image ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80";
    image.alt = product.name;
    name.textContent = product.name;
    desc.textContent = product.description || "暂无描述";
    price.textContent = formatPrice(product.price);
    stock.textContent = formatStock(product.stock);

    buy.disabled = Number(product.stock) <= 0;
    buy.addEventListener("click", () => handlePurchase(product));
    card.dataset.id = product.id;
    storefront.appendChild(node);
  });
};

const refreshUI = async () => {
  try {
    const products = await getProducts();
    renderInventory(products);
    renderStorefront(products);
  } catch (error) {
    console.error(error);
    if (inventoryList) {
      inventoryList.innerHTML =
        "<p class=\"item-desc\">无法加载商品，请确认后端已启动。</p>";
    }
    if (storefront) {
      storefront.innerHTML =
        "<p class=\"item-desc\">无法加载商品，请稍后再试。</p>";
    }
  }
};

const addProduct = async (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const name = formData.get("name").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));
  const image = formData.get("image").trim();
  const description = formData.get("description").trim();

  if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
    return;
  }

  try {
    if (editingId) {
      await updateProduct(editingId, {
        name,
        price,
        stock,
        image,
        description,
      });
      setFormMode({ isEditing: false });
      await refreshUI();
      return;
    }

    await createProduct({
      name,
      price,
      stock,
      image,
      description,
      published: false,
    });

    setFormMode({ isEditing: false });
    await refreshUI();
  } catch (error) {
    alert(error.message || "保存失败，请稍后再试。");
  }
};

const togglePublish = async (product) => {
  try {
    await updateProduct(product.id, {
      published: !product.published,
    });
    await refreshUI();
  } catch (error) {
    alert(error.message || "更新失败，请稍后再试。");
  }
};

const removeProduct = async (id) => {
  try {
    await deleteProduct(id);
    if (editingId === id) {
      setFormMode({ isEditing: false });
    }
    await refreshUI();
  } catch (error) {
    alert(error.message || "删除失败，请稍后再试。");
  }
};

const handlePurchase = async (product) => {
  try {
    const updated = await createPurchase({
      product_id: product.id,
      quantity: 1,
    });
    await refreshUI();
    openModal({ ...product, stock: updated.stock });
  } catch (error) {
    alert(error.message || "购买失败，请稍后再试。");
  }
};

const openModal = (product) => {
  if (!modal) return;
  modalWallet.textContent = walletAddress;
  modalProduct.textContent = `商品：${product.name} · 支付金额：${formatPrice(product.price)}`;
  if (modalQr) {
    modalQr.src = qrUrl(`usdc:${walletAddress}?amount=${product.price}`);
  }
  modal.setAttribute("aria-hidden", "false");
};

const closePurchaseModal = () => {
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
};

const setupWallet = () => {
  const walletText = document.getElementById("walletAddress");
  if (walletText) {
    walletText.textContent = walletAddress;
  }
  if (walletQr) {
    walletQr.src = qrUrl(walletAddress);
  }
};

const setupLogin = () => {
  if (!loginModal || !loginForm) return;
  const isAuthed = sessionStorage.getItem(LOGIN_KEY) === "true";
  loginModal.setAttribute("aria-hidden", isAuthed ? "true" : "false");
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const password = formData.get("password");
    if (password === adminPassword) {
      sessionStorage.setItem(LOGIN_KEY, "true");
      loginModal.setAttribute("aria-hidden", "true");
      loginForm.reset();
      return;
    }
    alert("密码错误，请重试。");
  });
};

if (productForm) {
  productForm.addEventListener("submit", addProduct);
}
if (formCancel) {
  formCancel.addEventListener("click", () => setFormMode({ isEditing: false }));
}
if (copyWallet) {
  copyWallet.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      copyWallet.textContent = "已复制";
      setTimeout(() => {
        copyWallet.textContent = "复制地址";
      }, 1500);
    } catch {
      copyWallet.textContent = "复制失败";
    }
  });
}
if (closeModal) {
  closeModal.addEventListener("click", closePurchaseModal);
}
if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closePurchaseModal();
    }
  });
}

setupWallet();
setupLogin();
refreshUI();
