/**
 * Firebase data source. Since firebase does not allow cold start
 * this wrapper makes sure it works without network connection.
 */

const LOCAL_STORAGE_KEY = 'shiplog-data'
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

        this.db = firebase.database()

        // In any way, lets get firebase's full db, and update our local data right away.
    }
    init(user) {
        this.user = user
        let startTime = new Date();
        return new Promise((success) => {
            this.db.ref(`/userProfile/${user.uid}`).on('value', (snapshot) => {
                console.log('[db] got new value in ', new Date() - startTime, snapshot.val())
                // Update local store.
                // TODO: See performance errors on large updates!
                this.state.data = snapshot.val()

                // Save to cache.
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.state.data))
                success(this.state.data)
            });
        })
    }
    erase() {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
    }
    saveTheDay(id, day) {
        console.warn('save the day', id, day)
        // First we persist to our local store
        if (!this.state.data) this.state.data = { days: [] }
        this.state.data.days[id] = day
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.state.data))

        // Then we update in Firebase.
        this.db.ref(`/userProfile/${this.user.uid}/days/${id}`).update(day)

        // Check if the day has changed
        let hasAnythingChanged = !this.state.data || !this.state.data.days[id] || FIELDS_FOR_CHANGE
            .find((field) => day[field] !== this.state.data.days[id][field])
        if (hasAnythingChanged) {
            console.log('some stuff changed')
        }
        else {
            console.log('nothing changed')
        }
    }


}