// get quote of HSI futures
const http = require('http')
const cheerio = require('cheerio')
const moment = require('moment')
const chalk = require('chalk')

const DEFAULT_POLL_INTERVAL = 5
const ETNET_URL = 'http://www.etnet.com.hk/www/eng/futures/index.php'
const AASTOCKS_URL = 'http://www.aastocks.com/en/stocks/market/bmpfutures.aspx'

const pollInterval = process.argv.length > 2 ? Number(process.argv[2]) : DEFAULT_POLL_INTERVAL

function getUrl(url, converter) {
  const stime = new Date().getTime()
  return new Promise((resolve, reject) => {
    http.get(url, res => {
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
  console.log(chalk.cyan(moment(data.time).format('YYYY-MM-DDTHH:mm:ss.SSS')), chalk.green(data.price))
}

function once(fn) {
  if (!this.done) {
    fn()
    this.done = true
  }
}

etnetHsiFutures().then(printPrice)
setInterval(() => {
  etnetHsiFutures().then(printPrice)
}, pollInterval*1000)
