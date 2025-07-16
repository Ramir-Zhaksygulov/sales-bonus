// Функция расчета выручки с учетом скидки
function calculateSimpleRevenue(purchase, product) {
  const { sale_price, quantity, discount } = purchase;
  return sale_price * quantity * (1 - discount / 100);
}

// Функция расчета бонуса на основе прибыли
function calculateBonusByProfit(records, stats) {
  if (!Array.isArray(records)) {
    throw new TypeError("records должен быть массивом");
  }

  const sellerProfits = {};

  for (const record of records) {
    const product = stats.products[record.sku];
    const profitPerItem =
      (record.sale_price - product.purchase_price) *
      (1 - record.discount / 100);
    const profit = profitPerItem * record.quantity;

    if (!sellerProfits[record.seller_id]) {
      sellerProfits[record.seller_id] = 0;
    }
    sellerProfits[record.seller_id] += profit;
  }

  return Object.entries(sellerProfits).map(([seller_id, profit]) => ({
    seller_id,
    bonus: +(profit * 0.15).toFixed(2),
  }));
}

// Основная функция анализа данных
function analyzeSalesData(data, options) {
  if (
    !options ||
    typeof options.calculateRevenue !== "function" ||
    typeof options.calculateBonus !== "function"
  ) {
    throw new Error("Переданы некорректные опции");
  }

  if (!data || typeof data !== "object") throw new Error("Отсутствуют данные");
  if (!Array.isArray(data.sellers) || data.sellers.length === 0)
    throw new Error("Отсутствуют продавцы");
  if (!Array.isArray(data.products) || data.products.length === 0)
    throw new Error("Отсутствуют товары");
  if (
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  )
    throw new Error("Отсутствуют покупки");

  const { sellers, products, purchase_records } = data;

  // Преобразуем товары в удобный объект по SKU
  const productMap = {};
  for (const product of products) {
    productMap[product.sku] = product;
  }

  const stats = {
    sellers: {},
    products: productMap,
    customers: {},
  };

  // Считаем метрики по каждому продавцу
  for (const seller of sellers) {
    stats.sellers[seller.id] = {
      revenue: 0,
      profit: 0,
      sales_count: 0,
      top_products: [],
      products_count: {},
    };
  }

  for (const record of purchase_records) {
    const product = productMap[record.sku];
    const sellerStat = stats.sellers[record.seller_id];

    const revenue = options.calculateRevenue(record, product);
    const profit =
      (record.sale_price - product.purchase_price) *
      record.quantity *
      (1 - record.discount / 100);

    sellerStat.revenue += revenue;
    sellerStat.profit += profit;
    sellerStat.sales_count += 1;

    sellerStat.products_count[record.sku] =
      (sellerStat.products_count[record.sku] || 0) + record.quantity;
  }

  // Заполняем топ-продукты
  for (const sellerId in stats.sellers) {
    const sellerStat = stats.sellers[sellerId];
    const topProducts = Object.entries(sellerStat.products_count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sku, quantity]) => ({ sku, quantity }));

    sellerStat.top_products = topProducts;
  }

  // Считаем бонусы
  const bonuses = options.calculateBonus(purchase_records, stats);

  // Собираем финальный отчет
  return sellers.map((seller) => {
    const sellerStats = stats.sellers[seller.id];
    const bonusObj = bonuses.find((b) => b.seller_id === seller.id);

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: +sellerStats.revenue.toFixed(2),
      profit: +sellerStats.profit.toFixed(2),
      bonus: bonusObj ? bonusObj.bonus : 0,
      sales_count: sellerStats.sales_count,
      top_products: sellerStats.top_products,
    };
  });
}

// Экспортируем функции
export { calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
