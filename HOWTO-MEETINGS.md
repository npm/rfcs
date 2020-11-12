# How to run an Open RFC Meeting

**Note:** Much of the current RFC meeting process is handled manually, if you find time to automate any of this it would be greatly appreciated <3 
 
## Preparation 

#### Week before...
- Ensure an event has been booked in the [**Public Events Calendar**](https://calendar.google.com/calendar/ical/npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com/public/basic.ics) (note: the title of the event must start with "Open RFC") at least a week ahead of time
- The week before, or week of, run the `npm run agenda` script to create the agenda issue in `npm/rfcs` via https://github.com/npm/statusboard (TODO: this script should be moved & the GitHub Action/Workflow should be fixed - as it's broken currently)

#### Day-of...
1. Create a [**hackmd.io**](https://hackmd.io/) shared document & copy the agenda into the [example template](#meeting-notes-template)
1. Sync up with marketing to have a reminder tweet go out at some point in the day
1. Go to [YouTube.com](https://youtube.com) & sign in under your `@npmjs.com` email & then switch accounts to **"npm inc."**
1. Click **"Create"** > **"Go Live"**
1. You should see a prompt to **"Copy"** the last stream's settings or to start a net new stream (if you're copying, you'll have the option to set the time when the stream will start)
1. Ensure the stream key is set to **"Open RFC: Permanent Key"** & that visibility is set to **"Public"**
1. In the top right of the screen you'll see a "Share" icon where you can get a link to the video/stream
1. Message &/or mention a person from marketing in the **`#npm-cli`** Slack Channel with a reference to the video/stream url for use on Twitter
1. Jump into the **zoom** meeting about 10 minutes early

> Note: Ensure you keep the **YouTube Studio** open in a tab during the call

#### During the Call...
1. Ensure you are the **Host** of the call (if for any reason you cannot get this access, you may need to **Record** the meeting locally & upload the video to YouTube later)
1. When you're ready to start streaming from zoom, click **"More" > "Live on Custom Live Stream Service"**
1. Back in **YouTube Studio**, you should now see a preview of the stream come through (note: this can take a few seconds)
1. Once the preview is visible, click **"Go Live"** in the top right corner (you can ensure the stream is live on YouTube by checking the "Share" url from before)
1. Jump back to the zoom call
1. Run through a quick introduction (ie. welcome messaging, acknowledge new attendees, reference CoC & give time for any announcements etc.)
1. Continue on to moderate the discussion (ie. timebox discussions, ensure action items are identified etc.)
1. End the call with thanks & an acknowledgement of the next call

#### After the Call...
1. Stop the stream on YouTube by clicking **"End Stream"**
1. Fill out any missing information - including description, tags, playlist reference, visibility level etc. - of the video artifact in YouTube Studio
1. Add the meeting minutes to [`/meetings`](https://github.com/npm/rfcs/tree/latest/meetings)
1. Add a comment to the Agenda issue that references the location of the meeting notes & the YouTube recording
1. Close the Agenda issue

## References / Resources

#### Public Events Calendar links

* gCal: [`https://calendar.google.com/calendar/embed?src=npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com`](https://calendar.google.com/calendar/embed?src=npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com)
* iCal: [`https://calendar.google.com/calendar/ical/npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com/public/basic.ics`](https://calendar.google.com/calendar/ical/npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com/public/basic.ics)

#### Meeting Notes Template

```md
#### Meeting from: <date>

# Open RFC Meeting (npm)

### Attendees
- 

### Agenda
1. **Housekeeping**
	1. Introduction(s) (ex. note the name of the call, state the week day & date)
	1. [Code of Conduct Acknowledgement](https://www.npmjs.com/policies/conduct)
	1. Outline Intentions & Desired Outcomes (ex. want to interact with the community to ensure that there is movement on important issues/ideas for the project)
	1. Announcements
1. <agenda>

### Notes
- 
```
