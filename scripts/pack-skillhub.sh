#!/bin/sh
# 把仓库当前提交打成发布到小红书 Skill 中心的目录（只打包，不发布）。
# 用法：sh scripts/pack-skillhub.sh [输出父目录]，默认放到临时目录，最后一行输出包目录路径。
# Skill 中心只收常见文本扩展名（.md .txt .html .css .js .json .sh 等），
# 所以去掉 .gitignore、docs/ 截图，README 里的截图换成 GitHub 链接。
set -eu

REPO_URL=https://github.com/tankxu/xhs-minitool-preview
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT_PARENT=${1:-$(mktemp -d)}
PKG="$OUT_PARENT/xhs-minitool-preview"

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    echo "工作区有未提交的改动，先提交再打包（打包用的是 HEAD）" >&2
    exit 1
fi

rm -rf "$PKG"
mkdir -p "$OUT_PARENT"
git -C "$ROOT" archive HEAD --prefix=xhs-minitool-preview/ | tar -x -C "$OUT_PARENT"

rm -rf "$PKG/.gitignore" "$PKG/docs"
sed -i.bak "s#^!\[预览效果\](docs/screenshot.png)\$#效果截图见 GitHub：$REPO_URL#" "$PKG/README.md"
rm -f "$PKG/README.md.bak"

bad=$(find "$PKG" -type f ! -name '*.md' ! -name '*.txt' ! -name '*.html' ! -name '*.htm' ! -name '*.css' \
    ! -name '*.js' ! -name '*.json' ! -name '*.xml' ! -name '*.sh' ! -name '*.py' ! -name '*.svg')
if [ -n "$bad" ]; then
    echo "以下文件 Skill 中心可能不收，确认后再发布：" >&2
    echo "$bad" >&2
fi
if grep -q 'docs/' "$PKG/README.md"; then
    echo "README.md 里还有指向 docs/ 的引用" >&2
fi

echo "提交：$(git -C "$ROOT" rev-parse --short HEAD)，文件 $(find "$PKG" -type f | wc -l | tr -d ' ') 个" >&2
echo "$PKG"
