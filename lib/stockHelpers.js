// /lib/stockHelpers.js

// Lấy tên/nhãn size từ một object bất kỳ trong mảng product.size
export const getSizeName = (obj) =>
    obj?.size ??
    obj?.name ??
    obj?.label ??
    obj?.title ??
    obj?.Size ??
    obj?.SIZE ??
    "";

// Chuẩn hoá key (để tìm field số lượng bất kể đặt tên thế nào)
const normalizeKey = (s) => s?.toString().toLowerCase().trim();

/**
 * Tìm ra "tên field số lượng" trong object size
 * Hỗ trợ nhiều cách đặt tên: qty, quantity, stock, amount, so_luong, soluong, remain
 */
export const getQtyFieldKey = (obj) => {
    const keys = Object.keys(obj || {}).map((k) => normalizeKey(k));
    const map = Object.fromEntries(
        Object.keys(obj || {}).map((k) => [normalizeKey(k), k])
    );
    const candidates = [
        "qty",
        "quantity",
        "stock",
        "amount",
        "so_luong",
        "soluong",
        "remain",
    ];
    for (const c of candidates) {
        const idx = keys.indexOf(c);
        if (idx !== -1) return map[c];
    }
    return null; // Không tìm thấy trường số lượng
};

/**
 * Trừ/tăng tồn theo size
 * @param {Document} product - doc Mongoose của Product (có field size là mảng)
 * @param {string} sizeLabel - tên/nhãn size cần trừ/tăng
 * @param {number} delta - số lượng cộng (+) hoặc trừ (-)
 * @return {boolean} - true nếu đã chỉnh được tồn, false nếu không
 */
export function adjustProductStockBySize(product, sizeLabel, delta) {
    if (!Array.isArray(product.size)) return false;

    const target = (sizeLabel ?? "").toString().trim();
    const idx = product.size.findIndex((sv) => {
        const name = (getSizeName(sv) ?? "").toString().trim();
        return name === target;
    });

    if (idx === -1) return false;

    const qtyField = getQtyFieldKey(product.size[idx]);
    if (!qtyField) return false;

    const cur = Number(product.size[idx][qtyField] ?? 0);
    product.size[idx][qtyField] = cur + Number(delta || 0);
    product.markModified("size"); // báo cho Mongoose biết field lồng nhau đã đổi
    return true;
}
