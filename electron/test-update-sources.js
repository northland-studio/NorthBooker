/**
 * 北牖 NorthBooker 双源更新测试脚本
 * 用法: node test-update-sources.js
 *
 * 测试两个更新源是否可用：
 *   源1: GitHub Release (主源)
 *   源2: CDN 后端代理 (备用源)
 */

const https = require('https')
const path = require('path')
const pkg = require('./package.json')

// ===== 配置 =====
const GITHUB_OWNER = 'northland-studio'
const GITHUB_REPO = 'NorthBooker'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
const CDN_BASE = 'https://northbooker.xuanjian.top/api/updates'

// ===== 工具函数 =====
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'NorthBooker-Updater-Test/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve({ status: res.statusCode, body })
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')) })
  })
}

// 简易 YAML 解析（仅提取 version 字段）
function parseYamlVersion(yaml) {
  const m = yaml.match(/^version:\s*(\S+)/m)
  return m ? m[1] : null
}

// 简易 YAML 解析（提取文件列表）
function parseYamlFiles(yaml) {
  const files = []
  const lines = yaml.split('\n')
  let inFiles = false
  for (const line of lines) {
    if (line.startsWith('files:')) { inFiles = true; continue }
    if (inFiles) {
      const m = line.match(/^\s*-\s*url:\s*(\S+)/)
      if (m) files.push(m[1])
      else if (line.trim() && !line.startsWith(' ')) break
    }
  }
  return files
}

// ===== 测试源 1: GitHub Release =====
async function testGitHub() {
  const result = { ok: false, version: null, error: null, details: [] }
  console.log('═══ 源1: GitHub Release ═══')
  console.log(`仓库: ${GITHUB_OWNER}/${GITHUB_REPO}`)

  try {
    // 1.1 获取最新 Release
    const releaseResp = await httpsGet(`${GITHUB_API}/releases/latest`)
    if (releaseResp.status !== 200) {
      result.error = `GitHub API 返回 ${releaseResp.status}`
      console.log(`  ✗ ${result.error}`)
      return result
    }

    const release = JSON.parse(releaseResp.body)
    const tagName = release.tag_name
    console.log(`  最新 Release: ${tagName}`)

    // 1.2 检查 Release 是否包含 .exe
    const exeAsset = release.assets.find((a) => a.name.endsWith('.exe'))
    if (exeAsset) {
      console.log(`  EXE 资产: ${exeAsset.name} (${(exeAsset.size / 1024 / 1024).toFixed(1)} MB)`)
      result.details.push(`exe: ${exeAsset.name}`)
    } else {
      console.log(`  ⚠ 未找到 .exe 资产（可能被 electron-builder 上传到其他位置）`)
    }

    // 1.3 尝试获取 latest.yml（electron-updater 用）
    // electron-builder GitHub provider 会在 release assets 或特定 URL 放 latest.yml
    const ymlUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tagName}/latest.yml`
    try {
      const ymlResp = await httpsGet(ymlUrl)
      if (ymlResp.status === 200) {
        const version = parseYamlVersion(ymlResp.body)
        const files = parseYamlFiles(ymlResp.body)
        console.log(`  latest.yml: 版本=${version}, 文件数=${files.length}`)
        result.version = version
        result.ok = true
      } else {
        // 尝试从 release assets 中找 latest.yml
        const ymlAsset = release.assets.find((a) => a.name === 'latest.yml')
        if (ymlAsset) {
          const ymlAssetResp = await httpsGet(ymlAsset.browser_download_url)
          if (ymlAssetResp.status === 200) {
            const version = parseYamlVersion(ymlAssetResp.body)
            console.log(`  latest.yml (from assets): 版本=${version}`)
            result.version = version
            result.ok = true
          }
        }
      }
    } catch (e) {
      console.log(`  ⚠ latest.yml 获取失败: ${e.message}`)
      // 即使没有 latest.yml，Release 本身可用也算部分 OK
      if (exeAsset) {
        result.ok = true
        result.details.push('latest.yml 不可用但 Release 存在')
      }
    }
  } catch (e) {
    result.error = e.message
    console.log(`  ✗ ${e.message}`)
  }

  if (result.ok) {
    console.log(`  ✓ GitHub 主源可用`)
  } else {
    console.log(`  ✗ GitHub 主源不可用`)
  }
  return result
}

// ===== 测试源 2: CDN 后端代理 =====
async function testCDN() {
  const result = { ok: false, version: null, error: null, details: [] }
  console.log('\n═══ 源2: CDN (后端代理) ═══')
  console.log(`URL: ${CDN_BASE}`)

  // 2.1 获取 latest.yml
  try {
    const ymlResp = await httpsGet(`${CDN_BASE}/latest.yml`)
    if (ymlResp.status !== 200) {
      result.error = `latest.yml 返回 ${ymlResp.status}`
      console.log(`  ✗ ${result.error}`)
      return result
    }

    const version = parseYamlVersion(ymlResp.body)
    const files = parseYamlFiles(ymlResp.body)
    console.log(`  latest.yml: 版本=${version}, 文件数=${files.length}`)
    result.version = version

    // 2.3 检查文件列表中的第一个 .exe 是否可访问
    let exeChecked = false
    for (const f of files) {
      if (f.endsWith('.exe') || f.endsWith('.exe.blockmap')) {
        try {
          const fileUrl = f.startsWith('http') ? f : `https://northbooker.xuanjian.top${f.startsWith('/') ? '' : '/'}${f}`
          const fileResp = await httpsGet(fileUrl)
          const status = fileResp.status
          if (f.endsWith('.exe') && !exeChecked) {
            console.log(`  ${f}: HTTP ${status} (${(fileResp.body.length / 1024 / 1024).toFixed(1)} MB)`)
            exeChecked = true
          }
          result.details.push(`${f}: ${status}`)
          if (status === 200) result.ok = true
        } catch (e) {
          console.log(`  ${f}: 不可达 - ${e.message}`)
          result.details.push(`${f}: 不可达`)
        }
      }
    }

    if (!exeChecked) {
      const expectedExe = `北牖 NorthBooker Setup ${version}.exe`
      try {
        const exeResp = await httpsGet(`${CDN_BASE}/files/${encodeURIComponent(expectedExe)}`)
        console.log(`  ${expectedExe}: HTTP ${exeResp.status}`)
        if (exeResp.status >= 200 && exeResp.status < 400) result.ok = true
      } catch (e) {
        console.log(`  ${expectedExe}: 不可达`)
      }
    }
  } catch (e) {
    result.error = e.message
    console.log(`  ✗ ${e.message}`)
  }

  if (result.ok) {
    console.log(`  ✓ CDN 备用源可用`)
  } else {
    console.log(`  ✗ CDN 备用源不可用`)
  }
  return result
}

// ===== 主流程 =====
async function main() {
  console.log(`北牖 NorthBooker 双源更新测试 v${pkg.version}`)
  console.log('='.repeat(50))

  const [ghResult, cdnResult] = await Promise.all([testGitHub(), testCDN()])

  // ===== 汇总报告 =====
  console.log('\n══════════════════════════════')
  console.log('        测试报告')
  console.log('══════════════════════════════')
  console.log(`本地版本:   ${pkg.version}`)

  const ghStatus = ghResult.ok ? '✓ 可用' : '✗ 不可用'
  const ghVer = ghResult.version || 'N/A'
  console.log(`GitHub 源:  ${ghStatus}  (最新: ${ghVer})`)

  const cdnStatus = cdnResult.ok ? '✓ 可用' : '✗ 不可用'
  const cdnVer = cdnResult.version || 'N/A'
  console.log(`CDN 源:    ${cdnStatus}  (最新: ${cdnVer})`)

  // 版本比较
  if (ghResult.version && cdnResult.version) {
    if (ghResult.version === cdnResult.version) {
      console.log(`版本一致:   ${ghResult.version}`)
    } else {
      console.log(`⚠ 版本不一致! GitHub=${ghResult.version}, CDN=${cdnResult.version}`)
    }
  }

  // 可用性判断
  if (ghResult.ok && cdnResult.ok) {
    console.log('\n✓ 双源均可用，自动更新正常')
  } else if (ghResult.ok) {
    console.log(`\n⚠ 仅 GitHub 主源可用，CDN 备用源不可用: ${cdnResult.error || '未知'}`)
  } else if (cdnResult.ok) {
    console.log(`\n⚠ 仅 CDN 备用源可用，GitHub 主源不可用: ${ghResult.error || '未知'}`)
  } else {
    console.log(`\n✗ 双源均不可用!`)
    if (ghResult.error) console.log(`  GitHub: ${ghResult.error}`)
    if (cdnResult.error) console.log(`  CDN: ${cdnResult.error}`)
  }

  // 退出码
  process.exit(ghResult.ok || cdnResult.ok ? 0 : 1)
}

main().catch((e) => {
  console.error('测试异常:', e.message)
  process.exit(2)
})
