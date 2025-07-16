// Группировка массива по ключу
function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// Подсчет среднего значения
function calculateAverage(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length || 0;
}

// Анализ последовательности на стабильность/рост/падение
function analyzSequence(sequence, tolerance = 0.05) {
  const trends = {
    isStable: true,
    isIncreasing: false,
    isDecreasing: false,
  };

  if (sequence.length < 2) return trends;

  const start = sequence[0];
  const end = sequence[sequence.length - 1];
  const totalChange = end - start;

  for (let i = 1; i < sequence.length; i++) {
    const relativeChange =
      Math.abs(sequence[i] - sequence[i - 1]) / Math.abs(sequence[i - 1]);
    if (relativeChange > tolerance) {
      trends.isStable = false;
      break;
    }
  }

  trends.isIncreasing = totalChange > 0;
  trends.isDecreasing = totalChange < 0;

  return trends;
}

// Расчет прибыли: (продажная цена - закупочная) * количество
function calculateSimpleRevenue(item, product) {
  return (
    item.sale_price * item.quantity * (1 - item.discount / 100) -
    product.purchase_price * item.quantity
  );
}

// Сбор статистики для продавцов и покупателей
function calculateBonusByProfit(records, calculateRevenue, products) {
  if (!Array.isArray(records)) {
    throw new TypeError("records должен быть массивом");
  }
  if (!Array.isArray(products)) {
    throw new TypeError("products должен быть массивом");
  }

  return records.reduce(
    (acc, record) => {
      const sellerId = record.seller_id;
      const customerId = record.customer_id;

      if (!acc.sellers[sellerId])
        acc.sellers[sellerId] = {
          revenue: 0,
          profit: 0,
          items: [],
          customers: new Set(),
        };

      if (!acc.customers[customerId])
        acc.customers[customerId] = {
          revenue: 0,
          profit: 0,
          sellers: new Set(),
        };

      record.items.forEach((item) => {
        const product = products.find((p) => p.sku === item.sku);
        const profit = calculateRevenue(item, product);

        // Обновляем данные по продавцу
        acc.sellers[sellerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.sellers[sellerId].profit += profit;
        acc.sellers[sellerId].items.push(item);
        acc.sellers[sellerId].customers.add(customerId);

        // Обновляем данные по покупателю
        acc.customers[customerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.customers[customerId].profit += profit;
        acc.customers[customerId].sellers.add(sellerId);

        // Обновляем статистику по товарам
        if (!acc.products[item.sku])
          acc.products[item.sku] = { quantity: 0, revenue: 0 };
        acc.products[item.sku].quantity += item.quantity;
        acc.products[item.sku].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
      });

      return acc;
    },
    { sellers: {}, customers: {}, products: {} }
  );
}

// Основная функция анализа данных продаж
function analyzeSalesData(data, options, bonusFunctions = []) {
  // Валидация входных данных
  if (!data || typeof data !== "object") {
    throw new Error("Некорректные входные данные");
  }

  const requiredFields = ["sellers", "products", "purchase_records"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Отсутствует поле: ${field}`);
    }
    if (!Array.isArray(data[field]) || data[field].length === 0) {
      throw new Error(`Поле ${field} должно быть непустым массивом`);
    }
  }

  // Валидация опций
  if (
    !options ||
    typeof options !== "object" ||
    typeof options.calculateRevenue !== "function" ||
    typeof options.calculateBonus !== "function"
  ) {
    throw new Error("Некорректные опции");
  }

  const { calculateRevenue, calculateBonus } = options;

  // Группировка данных для анализа
  const recordsBySeller = groupBy(
    data.purchase_records,
    (record) => record.seller_id
  );
  const recordsByCustomer = groupBy(
    data.purchase_records,
    (record) => record.customer_id
  );
  const recordsByProduct = groupBy(
    data.purchase_records.flatMap((record) => record.items),
    (item) => item.sku
  );

  const stats = calculateBonus(
    data.purchase_records,
    calculateRevenue,
    data.products
  );

  // Применяем бонус-функции
  return bonusFunctions.map((func) =>
    func({
      stats,
      recordsBySeller,
      recordsByCustomer,
      recordsByProduct,
      sellers: data.sellers,
      customers: data.customers,
      products: data.products,
      calculateRevenue,
    })
  );
}

// Экспорт
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData,
    bonusBestCustomer,
    bonusCustomerRetention,
    bonusLargestSingleSale,
    bonusHighestAverageProfit,
    bonusStableGrowth,
  };
}
