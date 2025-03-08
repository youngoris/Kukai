#!/bin/bash

# 修复screens目录中的导入路径
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./|import * from "../|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./constants/|import * from "../constants/|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./services/|import * from "../services/|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./utils/|import * from "../utils/|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./components/|import * from "../components/|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./hooks/|import * from "../hooks/|g' {} \;
find src/screens -name "*.js" -type f -exec sed -i '' 's|import .* from "./assets/|import * from "../assets/|g' {} \;

# 修复components目录中的导入路径
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./|import * from "../|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./constants/|import * from "../constants/|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./services/|import * from "../services/|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./utils/|import * from "../utils/|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./components/|import * from "./|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./hooks/|import * from "../hooks/|g' {} \;
find src/components -name "*.js" -type f -exec sed -i '' 's|import .* from "./assets/|import * from "../assets/|g' {} \;

# 修复services目录中的导入路径
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./|import * from "../|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./constants/|import * from "../constants/|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./services/|import * from "./|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./utils/|import * from "../utils/|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./components/|import * from "../components/|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./hooks/|import * from "../hooks/|g' {} \;
find src/services -name "*.js" -type f -exec sed -i '' 's|import .* from "./assets/|import * from "../assets/|g' {} \;

# 修复utils目录中的导入路径
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./|import * from "../|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./constants/|import * from "../constants/|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./services/|import * from "../services/|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./utils/|import * from "./|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./components/|import * from "../components/|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./hooks/|import * from "../hooks/|g' {} \;
find src/utils -name "*.js" -type f -exec sed -i '' 's|import .* from "./assets/|import * from "../assets/|g' {} \;

# 修复hooks目录中的导入路径
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./|import * from "../|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./constants/|import * from "../constants/|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./services/|import * from "../services/|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./utils/|import * from "../utils/|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./components/|import * from "../components/|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./hooks/|import * from "./|g' {} \;
find src/hooks -name "*.js" -type f -exec sed -i '' 's|import .* from "./assets/|import * from "../assets/|g' {} \;

echo "导入路径修复完成！" 