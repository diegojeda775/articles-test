const { expect } = require('chai')
const knex = require('knex')
const supertest = require('supertest')
const app = require('../src/app')

describe.only('Articles Endpoints', function() {
    let db

    before('make knex instance', () => {
        db = knex({
        client: 'pg',
        connection: process.env.TEST_DB_URL,
        })
        app.set('db', db)
    })

    after('disconnect from db', () => db.destroy())

    before('clean the table', () => db('blogful_articles').truncate())
    afterEach('cleanup', () => db('blogful_articles').truncate())

    describe(`GET /articles`, () => {
        context(`Given no articles`, () => {
             it(`responds with 200 and an empty list`, () => {
                return supertest(app)
                    .get('/articles')
                    .expect(200, [])
                })
           })
    })

    describe(`GET /articles/:article_id`, () => {
        context(`Given no articles`, () => {
            it(`responds with 404`, () => {
                const articleId = 123456
                return supertest(app)
                    .get(`/articles/${articleId}`)
                    .expect(404, { error: { message: `Article doesn't exist` } })
            })
    
        })
    })

        context('Given there are articles in the database', () => {
            const testArticles = [
                {
                    id: 1,
                    date_published: '2029-01-22T16:28:32.615Z',
                    title: 'First test post!',
                    style: 'How-to',
                    content: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Natus consequuntur deserunt commodi, nobis qui inventore corrupti iusto aliquid debitis unde non.Adipisci, pariatur.Molestiae, libero esse hic adipisci autem neque ?'
                },
                {
                    id: 2,
                    date_published: '2100-05-22T16:28:32.615Z',
                    title: 'Second test post!',
                    style: 'News',
                    content: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum, exercitationem cupiditate dignissimos est perspiciatis, nobis commodi alias saepe atque facilis labore sequi deleniti. Sint, adipisci facere! Velit temporibus debitis rerum.'
                },
                {
                    id: 3,
                    date_published: '1919-12-22T16:28:32.615Z',
                    title: 'Third test post!',
                    style: 'Listicle',
                    content: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Possimus, voluptate? Necessitatibus, reiciendis? Cupiditate totam laborum esse animi ratione ipsa dignissimos laboriosam eos similique cumque. Est nostrum esse porro id quaerat.'
                },
                {
                    id: 4,
                    date_published: '1919-12-22T16:28:32.615Z',
                    title: 'Fourth test post!',
                    style: 'Story',
                    content: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Earum molestiae accusamus veniam consectetur tempora, corporis obcaecati ad nisi asperiores tenetur, autem magnam. Iste, architecto obcaecati tenetur quidem voluptatum ipsa quam?'
                },
            ];
        
            beforeEach('insert articles', () => {
                return db.into('blogful_articles').insert(testArticles)
            })

            it('GET /articles responds with 200 and all of the articles', () => {
                    return supertest(app).get('/articles').expect(200, testArticles)
                    // TODO: add more assertions about the body
            })

            it('GET /articles/:article_id responds with 200 and the specified article', () => {
                const articleId = 2
                const expectedArticle = testArticles[articleId - 1]
                return supertest(app).get(`/articles/${articleId}`).expect(200, expectedArticle)
            })

            context(`Given an XSS attack article`, () => {
                const maliciousArticle = {
                    id: 911,
                    title: 'Naughty naughty very naughty <script>alert("xss");</script>',
                    style: 'How-to',
                    content: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`
                }
        
                beforeEach('insert malicious article', () => {
                    return db
                        .into('blogful_articles')
                        .insert([ maliciousArticle ])
                })
        
                it('removes XSS attack content', () => {
                    return supertest(app)
                        .get(`/articles/${maliciousArticle.id}`)
                        .expect(200)
                        .expect(res => {
                        expect(res.body.title).to.eql('Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;')
                        expect(res.body.content).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`)
                        })
                })

                it('removes xss attack content from rsponse', () => {
                    return supertest(app)
                    .post('/articles')
                    .send(maliciousArticle)
                    .expect(201)
                    .expect(res => {
                        expect(res.body.title).to.eql('Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;')
                        expect(res.body.content).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`)
                    })
                })
            })

            it('Post /articles/:article_id responds with 201 and the new article', () => {
                this.retries(3);
                const newArticle = {
                    title: 'test-title',
                    style: 'Listicle',
                    content: 'test-content'
                }
                return supertest(app)
                    .post('/articles')
                    .send(newArticle)
                    .expect(201)
                    .expect( res => {
                        expect(res.body.title).to.eql(newArticle.title);
                        expect(res.body.style).to.eql(newArticle.style);
                        expect(res.body.content).to.eql(newArticle.content);
                        expect(res.body).to.have.property('id');
                        expect(res.headers.location).to.eql(`/article/${res.body.id}`);
                        const expected = new Date().toLocaleString;
                        const actual = new Date(res.body.date_published).toLocaleString;
                        expect(actual).to.eql(expected); 
                    })
                    .then(res =>
                        supertest(app)
                            .get(`/articles/${res.body.id}`)
                            .expect(res.body)
                    )
            })

            const requiredFields = ['title', 'style', 'content']

            requiredFields.forEach(field => {
                const newArticle = {
                    title: 'Test new article',
                    style: 'Listicle',
                    content: 'Test new article content...'
                }

                it(`responds with 400 and an error message when the '${field}' is missing`, () => {
                    delete newArticle[field]

                    return supertest(app)
                    .post('/articles')
                    .send(newArticle)
                    .expect(400, {
                        error: { message: `Missing '${field}' in request body` }
                    })
                })

            })
        })


})
