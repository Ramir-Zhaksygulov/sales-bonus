/**
 * Группировка массива по ключу
 */
function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Вычисление среднего значения
 */
function calculateAverage(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length || 0;
}

/**
 * Анализ последовательности на стабильность и рост
 */
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

/**
 * Выручка без учета закупа
 */
function calculateSimpleRevenue(item, product) {
  return item.sale_price * item.quantity * (1 - item.discount / 100);
}

/**
 * Расчет бонусов по прибыли
 */
function calculateBonusByProfit(records = [], calculateRevenue, products = []) {
  if (!Array.isArray(records)) {
    throw new TypeError("records должен быть массивом");
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
        const profit =
          item.sale_price * item.quantity * (1 - item.discount / 100) -
          product.purchase_price * item.quantity;

        acc.sellers[sellerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.sellers[sellerId].profit += profit;
        acc.sellers[sellerId].items.push(item);
        acc.sellers[sellerId].customers.add(customerId);

        acc.customers[customerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.customers[customerId].profit += profit;
        acc.customers[customerId].sellers.add(sellerId);

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

/**
 * Основная функция анализа
 */
function analyzeSalesData(data, options, bonusFunctions = []) {
  const { calculateRevenue, calculateBonus } = options;

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

// ==== БОНУСНЫЕ ФУНКЦИИ ====

function bonusBestCustomer({ stats }) {
  const bestCustomer = Object.entries(stats.customers).reduce(
    (max, [id, data]) =>
      data.revenue > (max?.revenue || 0) ? { id, ...data } : max,
    null
  );

  const sellerId = Array.from(bestCustomer.sellers).reduce(
    (topSeller, sellerId) => {
      const revenue = stats.sellers[sellerId]?.revenue || 0;
      return revenue > (topSeller?.revenue || 0)
        ? { sellerId, revenue }
        : topSeller;
    },
    null
  ).sellerId;

  return {
    category: "Best Customer Seller",
    seller_id: sellerId,
    bonus: +(bestCustomer.revenue * 0.05).toFixed(2),
  };
}

function bonusCustomerRetention({ stats }) {
  const bestRetention = Object.entries(stats.sellers).reduce(
    (best, [sellerId, data]) => {
      const customerCounts = Array.from(data.customers).map(
        (customerId) => stats.customers[customerId]?.revenue || 0
      );
      const maxCustomerRevenue = Math.max(...customerCounts);

      return maxCustomerRevenue > (best?.revenue || 0)
        ? { sellerId, revenue: maxCustomerRevenue }
        : best;
    },
    null
  );

  return {
    category: "Best Customer Retention",
    seller_id: bestRetention.sellerId,
    bonus: 1000,
  };
}

function bonusLargestSingleSale({ recordsBySeller }) {
  const largestSale = Object.entries(recordsBySeller).reduce(
    (max, [_, records]) => {
      const largestRecord = records.reduce(
        (recordMax, record) =>
          record.total_amount > (recordMax?.total_amount || 0)
            ? record
            : recordMax,
        null
      );
      return largestRecord?.total_amount > (max?.total_amount || 0)
        ? largestRecord
        : max;
    },
    null
  );

  return {
    category: "Largest Single Sale",
    seller_id: largestSale.seller_id,
    bonus: +(largestSale.total_amount * 0.1).toFixed(2),
  };
}

function bonusHighestAverageProfit({ stats }) {
  const bestSeller = Object.entries(stats.sellers).reduce(
    (max, [sellerId, data]) => {
      const avgProfit = data.profit / (data.items.length || 1);
      return avgProfit > (max?.avgProfit || 0) ? { sellerId, avgProfit } : max;
    },
    null
  );

  return {
    category: "Highest Average Profit",
    seller_id: bestSeller.sellerId,
    bonus: +(bestSeller.avgProfit * 0.1).toFixed(2),
  };
}

function bonusStableGrowth({ recordsBySeller, calculateRevenue, products }) {
  const bestSeller = Object.entries(recordsBySeller).reduce(
    (best, [sellerId, records]) => {
      const monthlyProfits = groupBy(records, (record) =>
        record.date.slice(0, 7)
      );
      const monthlyAverages = Object.entries(monthlyProfits)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([_, records]) =>
          calculateAverage(
            records.flatMap((record) =>
              record.items.map((item) =>
                calculateRevenue(
                  item,
                  products.find((p) => p.sku === item.sku)
                )
              )
            )
          )
        );

      const { isStable, isIncreasing } = analyzSequence(monthlyAverages, 0.05);

      if (isStable && isIncreasing) {
        const avgProfit = calculateAverage(monthlyAverages);
        return avgProfit > (best?.avgProfit || 0)
          ? { sellerId, avgProfit }
          : best;
      }

      return best;
    },
    null
  );

  return {
    category: "Stable Growth",
    seller_id: bestSeller?.sellerId,
    bonus: +(bestSeller ? bestSeller.avgProfit * 0.15 : 0).toFixed(2),
  };
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
