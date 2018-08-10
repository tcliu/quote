// get quote of HSI futures
const http = require('http')
const cheerio = require('cheerio')
const moment = require('moment')
const chalk = require('chalk')

const DEFAULT_POLL_INTERVAL = 5
const DATETIME_PATTERN = 'YYYY-MM-DD HH:mm:ss.SSS'
const ETNET_URL = 'http://www.etnet.com.hk/www/eng/futures/index.php'
const AASTOCKS_URL = 'http://www.aastocks.com/en/stocks/market/bmpfutures.aspx'

const pollInterval = process.argv.length > 2 ? Number(process.argv[2]) : DEFAULT_POLL_INTERVAL

// proxy setting (if applicable)
const proxy = {
  host: '',
  port: undefined
}

function getUrl(url, converter) {
  const stime = new Date().getTime()
  const opts = proxy.host ? Object.assign({}, proxy, {path: url}) : url
  return new Promise((resolve, reject) => {
    http.get(opts, res => {
      res.on('data', chunk => {
        const content = chunk.toString('utf8')
        const $ = cheerio.load(content)
        try {
          const data = converter($)
          if (data) {
            const wrapped = Object.assign({
              time: new Date(),
              fetchDuration: new Date().getTime() - stime
            }, data)
            resolve(wrapped)
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', reject)
      if (res.statusCode !== 200) {
        reject(res)
      }
    })
  })

}

function etnetHsiFutures() {
  once(() => console.log(`Fetching HSI future quote from ${chalk.magenta(ETNET_URL)}`))
  return getUrl(ETNET_URL, $ => {
    const fqc = $('.FuturesQuoteContent:nth-child(1)')
    if (fqc.length == 1) {
      const data = {
        name: text(fqc.find('.FuturesQuoteName')),
        price: Number(text(fqc.find('.FuturesQuoteNominal span')).replace(/,/g, '')),
        change: text(fqc.find('.FuturesQuoteChanged')),
        source: 'etnet'
      }
      return data
    }
  })
}

function aastocksHsiFutures() {
  once(() => console.log(`Fetching HSI future quote from ${chalk.magenta(AASTOCKS_URL)}`))
  return getUrl(AASTOCKS_URL, $ => {
    const tag = $('.font26.bold.cls.ff-arial')
    if (tag.length == 1) {
      const data = {
        price: Number(tag.text().replace(/,/g, '')),
        source: 'aastocks'
      }
      return data
    }
  })
}

function printPrice(data) {
  const dir = getDir(data.change)
  const dirColour = getDirColour(dir)
  console.log(chalk.cyan(moment(data.time).format(DATETIME_PATTERN)), chalk.yellow(data.price), chalk[dirColour](data.change))
}

function once(fn) {
  if (!this.done) {
    fn()
    this.done = true
  }
}

function handleError(res) {
  console.error(chalk.cyan(moment().format(DATETIME_PATTERN)), 'Status code', res.statusCode)
}

function text(node) {
  return node.text().trim().replace(/\s+/g, ' ')
}

function getDir(change) {
  if (change) {
    switch (change.charAt(0)) {
      case '-': return -1
      case '0': return 0
      default: return 1
    }
  }
  return 0
}

function getDirColour(dir) {
  switch (dir) {
    case -1: return 'red'
    case 0: return 'gray'
    case 1: return 'green'
  }
}

etnetHsiFutures().then(printPrice, handleError)
setInterval(() => {
  etnetHsiFutures().then(printPrice, handleError)
}, pollInterval*1000)
