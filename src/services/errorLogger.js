import AsyncStorage from '@react-native-async-storage/async-storage';

const ERROR_LOG_KEY = '@kukai/error_logs';

class ErrorLogger {
  async saveErrorLog(log) {
    try {
      const existingLogs = await this.getErrorLogs();
      const updatedLogs = [...existingLogs, log];
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Failed to save error log:', error);
    }
  }

  async getErrorLogs() {
    try {
      const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  }

  async clearErrorLogs() {
    try {
      await AsyncStorage.removeItem(ERROR_LOG_KEY);
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }

  logError(error, errorInfo, userInfo) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      errorInfo: errorInfo?.componentStack,
      userInfo,
    };

    // 在开发环境中打印错误
    if (__DEV__) {
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
    }

    // 保存错误日志
    this.saveErrorLog(errorLog);

    // 这里可以添加错误上报到服务器的逻辑
  }
}

export const errorLogger = new ErrorLogger(); 