const STORAGE_KEY = "codex-storefront-products";
const walletAddress = "0xeB595173c6199905AcE3ECE801207ab743C7b76f";

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

let editingId = null;

const getProducts = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveProducts = (products) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
};

const formatPrice = (price) => `${Number(price).toFixed(2)} USDC`;
const formatStock = (stock) => `库存 ${Number(stock)}`;

const setFormMode = ({ isEditing, product }) => {
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
    meta.textContent = `${formatPrice(product.price)} · ${formatStock(product.stock)}`;
    desc.textContent = product.description || "暂无描述";

    toggle.textContent = product.published ? "下架" : "上架";
    toggle.addEventListener("click", () => togglePublish(product.id));
    edit.addEventListener("click", () => setFormMode({ isEditing: true, product }));
    remove.addEventListener("click", () => removeProduct(product.id));

    item.classList.toggle("published", product.published);
    inventoryList.appendChild(node);
  });
};

const renderStorefront = (products) => {
  storefront.innerHTML = "";
  const published = products.filter((product) => product.published);
  if (!published.length) {
    storefront.innerHTML =
      "<p class=\"item-desc\">暂无上架商品，请在左侧上架。</p>";
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

    image.src = product.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80";
    image.alt = product.name;
    name.textContent = product.name;
    desc.textContent = product.description || "暂无描述";
    price.textContent = formatPrice(product.price);
    stock.textContent = formatStock(product.stock);

    buy.disabled = Number(product.stock) <= 0;
    buy.addEventListener("click", () => openModal(product));
    card.dataset.id = product.id;
    storefront.appendChild(node);
  });
};

const refreshUI = () => {
  const products = getProducts();
  renderInventory(products);
  renderStorefront(products);
};

const addProduct = (event) => {
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

  const products = getProducts();
  if (editingId) {
    const updated = products.map((product) =>
      product.id === editingId
        ? {
            ...product,
            name,
            price,
            stock,
            image,
            description,
          }
        : product
    );
    saveProducts(updated);
    setFormMode({ isEditing: false });
    refreshUI();
    return;
  }

  const product = {
    id: crypto.randomUUID(),
    name,
    price,
    stock,
    image,
    description,
    published: false,
  };

  products.unshift(product);
  saveProducts(products);
  setFormMode({ isEditing: false });
  refreshUI();
};

const togglePublish = (id) => {
  const products = getProducts();
  const updated = products.map((product) =>
    product.id === id ? { ...product, published: !product.published } : product
  );
  saveProducts(updated);
  refreshUI();
};

const removeProduct = (id) => {
  const products = getProducts();
  const updated = products.filter((product) => product.id !== id);
  saveProducts(updated);
  if (editingId === id) {
    setFormMode({ isEditing: false });
  }
  refreshUI();
};

const openModal = (product) => {
  modalWallet.textContent = walletAddress;
  modalProduct.textContent = `商品：${product.name} · 支付金额：${formatPrice(product.price)}`;
  modal.setAttribute("aria-hidden", "false");
};

const closePurchaseModal = () => {
  modal.setAttribute("aria-hidden", "true");
};

productForm.addEventListener("submit", addProduct);
formCancel.addEventListener("click", () => setFormMode({ isEditing: false }));
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
closeModal.addEventListener("click", closePurchaseModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closePurchaseModal();
  }
});

refreshUI();
