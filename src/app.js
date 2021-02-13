require('dotenv').config()
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const helmet = require('helmet')
const { NODE_ENV } = require('./config')
const ArticlesService = require('./articles-service')
const xss = require('xss');

const app = express()
const jsonParser = express.json();

const morganOption = (NODE_ENV === 'production')
  ? 'tiny'
  : 'common';

app.use(morgan(morganOption))
app.use(cors())
app.use(helmet())

app.get('/articles', (req, res, next) => {
  const knexInstance = req.app.get('db')
  ArticlesService.getAllArticles(knexInstance)
      .then(articles => {
        res.json(articles)
      })
      .catch(next)
})

app.get('/articles/:article_id', (req, res, next) => {
  const knexInstance = req.app.get('db')
  ArticlesService.getById(knexInstance, req.params.article_id)
    .then(article => {
      if (!article) {
        return res.status(404).json({
          error: { message: `Article doesn't exist` }
        })
      }
      res.json({
        id: article.id,
        style: article.style,
        title: xss(article.title), // sanitize title
        content: xss(article.content), // sanitize content
        date_published: article.date_published,
      })
    })
    .catch(next)
})

app.post('/articles', jsonParser, (req, res, next) => {
  const { title, content, style } = req.body;
  const newArticle = { title, content, style};

  for (const [key, value] of Object.entries(newArticle)) {
    if (value == null) {
      return res.status(400).json({
        error: { message: `Missing '${key}' in request body` }
      })
    }
  }

  ArticlesService.insertArticle(
    req.app.get('db'),
    newArticle
  )
    .then(article => {
      res.status(201)
        .location(`/articles/${article.id}`)
        .json({
          id: article.id,
          style: article.style,
          title: xss(article.title), // sanitize title
          content: xss(article.content), // sanitize content
          date_published: article.date_published,
        })
    })
    .catch(next);
})

app.get('/', (req, res) => {
    res.send('Hello, world!')
})

app.get('/xss', (req, res) => {
  res.cookie('secretToken', '1234567890');
  res.sendFile(__dirname + '/xss-example.html');
});

  app.use(function errorHandler(error, req, res, next) {
      let response
      if (NODE_ENV === 'production') {
        response = { error: { message: 'server error' } }
      } else {
        console.error(error)
        response = { message: error.message, error }
      }
      res.status(500).json(response)
    })

module.exports = app