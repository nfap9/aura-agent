// 模拟天气API
export async function getWeather(city: string): Promise<string> {
  // 实际项目中这里会调用真实的天气API
  const weatherData = {
    '北京': '晴天，25°C',
    '上海': '多云，22°C',
    '广州': '雨天，28°C'
  };
  
  return weatherData[city as keyof typeof weatherData] || '未知城市';
}

// 计算器
export function calculate(expression: string): string {
  try {
    // 注意：实际项目中需要安全的表达式求值
    const result = eval(expression);
    return `${expression} = ${result}`;
  } catch (error) {
    return '计算错误';
  }
}
