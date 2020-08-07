/**
 * Firebase data source. Since firebase does not allow cold start
 * this wrapper makes sure it works without network connection.
 */

import * as _ from '../node_modules/underscore/modules/index-all.js'

const LOCAL_STORAGE_KEY = 'shiplog-data'

// Only these keys persist.
const FIELDS_FOR_CHANGE = ['title', 'description', 'tags']

export default class FirebaseDbWrapper {
    constructor(firebase, state) {
        this.state = state
        let localStorageData = localStorage.getItem(LOCAL_STORAGE_KEY)
        // If we launched the app once already, let's pull the data from there first.
        // We assume, that if this is the case, we have been authed before, and we go accordingly.
        if (localStorageData) {
            this.state.data = JSON.parse(localStorageData)
        } else {
            this.state.data = false;
        }

        window._db = this.db = firebase.database()

        // In any way, lets get firebase's full db, and update our local data right away.
    }
    init(user, callback) {
        this.user = user
        let startTime = new Date();

        let dataRoot = this.db.ref(`/userProfile/${user.uid}`)
        dataRoot.on('value', (snapshot) => {
                // console.log('[db] got new value in ', new Date() - startTime, snapshot.val())
                // Update local store.
                // TODO: See performance errors on large updates!
                this.state.data = snapshot.val()

                // Save to cache.
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.state.data))
                // console.warn('backend data downloaded')
                callback(this.state.data)
        })
        // This is how we'd check this.
        // dataRoot.on('child_changed', (data)=>{
        //     console.warn('backend update', data)
        //     // setCommentValues(postElement, data.key, data.val().text, data.val().author);
        // });
    }
    erase() {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
    }
    saveTheDay(id, day) {
        // console.warn('save the day', id, day)
        // First we persist to our local store
        if (!this.state.data) this.state.data = {}
        if (!this.state.data.days) this.state.data.days = []


        // Clean the day: only store the observed keys.
        let dayToSave = {}
        FIELDS_FOR_CHANGE.map((field)=>dayToSave[field] = day[field])
        let previousDataOfDay = {}

        // Check if any field has changed, only save, if so.
        let hasItChanged = false
        if (this.state && this.state.data && this.state.data.days && this.state.data.days[id]){
            if (FIELDS_FOR_CHANGE.filter((field)=>{
                if (dayToSave[field] !== this.state.data.days[id][field]){
                    // console.log(id, field, 'changed from', this.state.data.days[id][field], 'to', dayToSave[field])
                    return true
                }
                }).length){
                hasItChanged = true;
            }
            previousDataOfDay = this.state.data.days[id]
            // If it was empty
        } else if (this.state && this.state.data && this.state.data.days && !this.state.data.days[id]) {
            hasItChanged = true;
        }
        if (!hasItChanged){
            // console.warn('nothing changed')
            return;
        }

        dayToSave.lastModify = new Date()

        let newDay = _.extend({}, previousDataOfDay, dayToSave)

        _.extend(this.state.data.days[id], dayToSave)
        // console.warn('saving the day db', id, JSON.stringify(newDay))

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.state.data))

        // Then we update in Firebase.
        return this.db.ref(`/userProfile/${this.user.uid}/days/${id}`).update(dayToSave).catch(() => {
            console.error('update error!', day)
        })

    }


}