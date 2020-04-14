/**
 * Firebase data source. Since firebase does not allow cold start
 * this wrapper makes sure it works without network connection.
 */



const LOCAL_STORAGE_KEY = 'shiplog-data'

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
        // TODO
    }
    init(user) {
        console.log('initing db', user.uid)
        // this.db.ref(`/userProfile/${user.uid}`).on('value', (snapshot)=>{
        //     console.log('[db] got new value', snapshot.val())
        //     // Update local store.
        //     // TODO: See performance errors on large updates!
        //     this.state.data = snapshot.val()

        //     // Save to cache.
        //     localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.state.data))
        // });

    }


}