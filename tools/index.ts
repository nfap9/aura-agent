export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称'
          }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate',
      description: '执行数学计算',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，如 "2 + 3 * 4"'
          }
        },
        required: ['expression']
      }
    }
  }
];
