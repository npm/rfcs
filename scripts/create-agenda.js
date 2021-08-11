(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { Octokit } = require('@octokit/rest')
  const Handlebars = require('handlebars')
  const source = fs.readFileSync(path.resolve(__dirname, 'agenda-template.hbs'), 'utf8')
  const template = Handlebars.compile(source)
  const fetch = require('node-fetch')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const datetime = `${now.getFullYear()}-${(now.getMonth() + 1)}-${now.getDate()}T10:00:00-07:00`
  const calendar = 'npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com'
  const force = ~process.argv.indexOf('-f') || ~process.argv.indexOf('--force')
  let options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  function createAgenda (title, formatted) {
    octokit.search.issuesAndPullRequests({ q: `label:"Agenda"+org:"npm"` }).then(response => {
      const items = response.data.items.map(i => `1. **${i.pull_request ? 'PR' : 'Issue'}**: [#${i.number} ${i.title}](${i.html_url}) - @${i.user.login}`).join('\n')
      const body = template({ formatted, items })
      console.log('Creating agenda:', formatted, title, body)
      octokit.issues.create({
        owner: 'npm',
        repo: 'rfcs',
        title,
        body,
        labels: ['Meeting'],
        assignees: ['darcyclarke']
      }).catch(e => console.error(e))
    }).catch(e => console.error(e))
  }
  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events?key=${process.env.CALENDAR_AUTH_TOKEN}&q="Open RFC"&timeMin=${datetime}&orderBy=starttime&singleEvents=true&maxResults=1`)
    const data = await response.json()
    const formatted = new Intl.DateTimeFormat('en-US', options).format(new Date(data.items[0].start.dateTime))
    const title = `Open RFC Meeting - ${formatted} EST`
    octokit.search.issuesAndPullRequests({ q: `author:darcyclarke+repo:npm/rfcs+"${title}"+in:title` })
      .then(respone => {
        if (respone.data.total_count) {
          console.log('Agenda already exists')
        }
        if (force) {
          console.log('Applying force...')
        }
        if (force || !respone.data.total_count) {
          createAgenda(title, formatted)
        }
      }).catch(e => console.error(e))
  } catch (e) {
    console.error(e)
  }
})()
