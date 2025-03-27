import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import DatabaseService from "./src/services/DatabaseService";
import EmergencyDatabaseFix from './src/utils/EmergencyDatabaseFix';

// 修改初始化函数，添加紧急数据库修复
async function initialize() {
  try {
    // 在尝试正常初始化之前先进行紧急修复检查
    try {
      // 检查数据库是否需要紧急修复
      const dbFixed = await EmergencyDatabaseFix.emergencyDatabaseFix();
      console.log(`紧急数据库修复结果: ${dbFixed ? '成功' : '失败'}`);
    } catch (fixError) {
      console.error('紧急数据库修复过程出错:', fixError);
      // 即使紧急修复失败，我们仍然尝试继续初始化
    }
    
    // 正常初始化流程
    console.log('Initializing database...');
    await DatabaseService.initialize();
    
    // ... 其他初始化代码 ...
    
  } catch (error) {
    // 处理初始化错误
    console.error('Error during initialization:', error);
  }
}

// 确保在组件挂载时调用初始化
export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  
  useEffect(() => {
    async function prepare() {
      try {
        // 保持启动屏幕可见，直到初始化完成
        await SplashScreen.preventAutoHideAsync();
        
        // 运行初始化
        await initialize();
        
        // 设置应用准备就绪
        setAppIsReady(true);
      } catch (e) {
        console.warn(e);
      } finally {
        // 准备就绪，可以隐藏启动屏幕
        await SplashScreen.hideAsync();
      }
    }
    
    prepare();
  }, []);
  
  // ... 其余的组件代码 ...
} 