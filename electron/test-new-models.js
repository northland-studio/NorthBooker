// 测试 theresa / melo 模型加载与合成（纯 Node）
const sherpa = require('sherpa-onnx-node')
const path = require('path')
const fs = require('fs')

const base = path.join(process.env.APPDATA || '', 'northbooker-desktop', 'tts-models')

function testModel(modelId, dir, onnx, opts = {}) {
  console.log(`\n===== ${modelId} =====`)
  const files = fs.readdirSync(dir)
  console.log('  files:', files.join(', '))
  const vits = { model: path.join(dir, onnx), tokens: path.join(dir, 'tokens.txt') }
  if (fs.existsSync(path.join(dir, 'lexicon.txt'))) vits.lexicon = path.join(dir, 'lexicon.txt')
  Object.assign(vits, opts)
  try {
    const t = new sherpa.OfflineTts({ model: { vits, debug: false, numThreads: 2, provider: 'cpu' }, maxNumSentences: 2 })
    console.log('  load OK, numSpeakers =', t.numSpeakers, '| sampleRate =', t.sampleRate)
    const genCfg = new sherpa.GenerationConfig({ sid: 0, speed: 1.0, silenceScale: 0.2 })
    const audio = t.generate({ text: '你好，这是模型加载测试。', generationConfig: genCfg })
    console.log('  generate OK, samples =', audio && audio.samples ? audio.samples.length : 'none')
    return true
  } catch (e) {
    console.log('  FAILED:', e.message)
    return false
  }
}

// theresa: 有 dict/ 目录
const theresaDir = path.join(base, 'vits-zh-hf-theresa')
// 方式1: 无 dataDir
testModel('theresa(无dataDir)', theresaDir, 'theresa.onnx')
// 方式2: dataDir=dict
testModel('theresa(dataDir=dict)', theresaDir, 'theresa.onnx', { dataDir: path.join(theresaDir, 'dict') })

// melo: 有 dict/ 目录
const meloDir = path.join(base, 'vits-melo-tts-zh_en')
testModel('melo(无dataDir)', meloDir, 'model.onnx')
testModel('melo(dataDir=dict)', meloDir, 'model.onnx', { dataDir: path.join(meloDir, 'dict') })
