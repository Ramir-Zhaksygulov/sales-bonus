/**
 * Группировка массива по ключу
 * @param array
 * @param keyFn
 * @returns {*}
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
 * @param values
 * @returns {number}
 */

function calculateAverage(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length || 0;
}

/**
 * @param sequence - массив чисел (последовательность)
 * @param tolerance - допустимое относительное изменение между соседними элементами последовательности для того, чтобы считать ее стабильной (по умолчанию 0.05, то есть 5%)
 * @returns {{isIncreasing: boolean, isDecreasing: boolean, isStable: boolean}}
 */

function analyzSequence(sequence, tolerance = 0.05) {
  // Инициализация объекта для хранения результатов анализа
  const trends = {
    isStable: true,
    isIncreasing: false,
    isDecreasing: false,
  };

  if (sequence.length < 2) {
    return trends;
  }

  const start = sequence[0];
  const end = sequence[sequence.length - 1];
  const totalChange = end - start; // Общее изменение между первым и последним значением

  // Проверяем стабильность: каждое значение должно быть в пределах tolerance от предыдущего
  for (let i = 1; i < sequence.length; i++) {
    const relativeChange =
      Math.abs(sequence[i] - sequence[i - 1]) / Math.abs(sequence[i - 1]);
    if (relativeChange > tolerance) {
      trends.isStable = false;
      break;
    }
  }

  // Подверка на рост или падение: если общее изменение больше 0 - это рост, если меньше 0 - падение
  trends.isIncreasing = totalChange > 0;
  trends.isDecreasing = totalChange < 0;

  return trends;
}

/**
 * Функция для расчета прибыли
 * @param item
 * @param product
 * @returns {number}
 */

function calculateSimpleRevenue(item, product) {
  return (
    item.sale_price * item.quantity * (1 - item.discount / 100) -
    product.purchase_price * item.quantity
  );
}

/**
 * Накопительное вычисление прибыли, выручки и других метрик
 * @param records
 * @param calculateRevenue
 * @param products
 * @returns {*}
 */

function calculateBonusByProfit(records, calculateRevenue, products) {
  // Принимает начальное значение аккумулятора { sellers: {}, customers: {}, products: {} } содержит статистику, сгрупированную по продавцам, покупателям и продуктам
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

      // Для каждого товара в record.items, находит соответствующий продукт в массиве products и рассчитывает прибыль товара
      record.items.forEach((item) => {
        // Находит соответствующий продукт в массиве products
        const product = products.find((p) => p.sku === item.sku);
        // Рассчитывает прибыль для товара
        const profit = calculateRevenue(item, product);

        // Обновление статистики продавца
        acc.sellers[sellerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.sellers[sellerId].profit += profit;
        acc.sellers[sellerId].items.push(item);
        acc.sellers[sellerId].customers.add(customerId);

        // Обновление статистики покупателя
        acc.customers[customerId].revenue +=
          item.sale_price * item.quantity * (1 - item.discount / 100);
        acc.customers[customerId].profit += profit;
        acc.customers[customerId].sellers.add(sellerId);

        // Обновление статистики по продуктам
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
 * Вычисление бонусов по специальным условиям
 * @param data
 * @param options {{calculateBonus: ((functions(*, *, *): *)|*), calculateRevenue: ((function(*, *): number)|*)}}
 * @param bonusFunctions
 * @returns {*}
 */

function analyzeSalesData(data, options, bonusFunctions) {
  const { calculateRevenue, calculateBonus } = options;
  // Группировка данных
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

  // Накопительная статистика
  const stats = calculateBonus(
    data.purchase_records,
    calculateRevenue,
    data.products
  );

  // Вызов функций для расчета бонусов
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

// 1. Продавец, привлекший лучшего покупателя
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

// 2. Продавец лучше всего удерживающий покупателя
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

// 3. Продавец, привлекший клиента с наибольшим чеком
function bonusLargestSingleSale({ recordsBySeller }) {
  const largestSale = Object.entries(recordsBySeller).reduce(
    (max, [sellerId, records]) => {
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

// 4. Продавец с наибольшей средней прибылью
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

// 5. Продавец со стабильно растущей средней прибылью
function bonusStableGrowth({ recordsBySeller, calculateRevenue, products }) {
  const bestSeller = Object.entries(recordsBySeller).reduce(
    (best, [sellerId, records]) => {
      const monthlyProfits = groupBy(records, (record) =>
        record.date.slice(0, 7)
      );
      const monthlyAverages = Object.entries(monthlyProfits)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([month, records]) =>
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
