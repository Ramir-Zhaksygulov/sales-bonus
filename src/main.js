// Функция расчёта выручки от продажи одного товара с учётом скидки
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity, discount } = purchase;

  // Переводим скидку в десятичный формат
  const discountFactor = 1 - discount / 100;

  // Выручка = цена * количество * (1 - скидка)
  return sale_price * quantity * discountFactor;
}

// Функция расчёта бонуса в зависимости от позиции продавца в рейтинге
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (index === 0) {
    // 15% для первого места
    return profit * 0.15;
  } else if (index === 1 || index === 2) {
    // 10% для второго и третьего места
    return profit * 0.1;
  } else if (index === total - 1) {
    // 0% для последнего места
    return 0;
  } else {
    // 5% для остальных
    return profit * 0.05;
  }
}

// Главная функция анализа продаж
function analyzeSalesData(data, options) {
  // Проверка корректности входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // Извлекаем переданные функции из объекта опций
  const { calculateRevenue, calculateBonus } = options;

  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Отсутствуют функции расчёта");
  }

  // Шаг 1: создаём заготовку статистики по каждому продавцу
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Шаг 2: создаём быстрые индексы по продавцам и товарам
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  // Шаг 3: обрабатываем все чеки и покупки
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // Пропускаем, если продавец не найден

    seller.sales_count += 1; // Увеличиваем количество продаж
    seller.revenue += record.total_amount; // Прибавляем сумму чека к выручке

    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) return; // Пропускаем, если товар не найден

      // Себестоимость товара = закупочная цена * количество
      const cost = product.purchase_price * item.quantity;

      // Выручка от товара с учётом скидки
      const revenue = calculateRevenue(item, product);

      // Прибыль = выручка - себестоимость
      const profit = revenue - cost;
      seller.profit += profit;

      // Учитываем количество проданных товаров по артикулу
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // Шаг 4: сортируем продавцов по убыванию прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 5: рассчитываем бонусы и топ-10 продуктов для каждого продавца
  sellerStats.forEach((seller, index) => {
    const total = sellerStats.length;

    // Расчёт бонуса через переданную функцию
    seller.bonus = calculateBonus(index, total, seller);

    // Формирование массива топ-10 товаров
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // Шаг 6: формируем и возвращаем итоговый отчёт
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2),
  }));
}
