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
  once(() => console.log(`Fetching HSI future quote from ${chalk.yellow(ETNET_URL)}`))
  return getUrl(ETNET_URL, $ => {
    const tag = $('.FuturesQuoteContent:nth-child(2) .FuturesQuoteNominal span')
    if (tag.length == 1) {
      const data = {
        price: Number(tag.text().replace(/,/g, '')),
        source: 'etnet'
      }
      return data
    }
  })
}

function aastocksHsiFutures() {
  once(() => console.log(`Fetching HSI future quote from ${chalk.yellow(AASTOCKS_URL)}`))
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
  console.log(chalk.cyan(moment(data.time).format(DATETIME_PATTERN)), chalk.green(data.price))
}

function handleError(res) {
  console.error(chalk.cyan(moment().format(DATETIME_PATTERN)), 'Status code', res.statusCode)
}

function once(fn) {
  if (!this.done) {
    fn()
    this.done = true
  }
}

etnetHsiFutures().then(printPrice, handleError)
setInterval(() => {
  etnetHsiFutures().then(printPrice, handleError)
}, pollInterval*1000)
