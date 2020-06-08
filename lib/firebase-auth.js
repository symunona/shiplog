
const LOCAL_STORAGE_AUTH_KEY = 'shiplog-auth'

// import state from './state'

export default class FirebaseAuth {
    constructor(firebase, state) {
        this.state = state
        this.firebase = firebase
        // By default, if we have a session stored, just use that.
        let formerSession = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)
        if (formerSession) {
            this.state.user = JSON.parse(formerSession)
            this.onLogin(this.state.user)
        }

        // Any ways, do auth on server side.
        this.state.loading.push('login')
        firebase.auth().onAuthStateChanged(user => {
            this.state.user = user
            if (user) {
                localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(user))
                if (!formerSession) {
                    this.onLogin(store.user)
                }
            } else {
                if (formerSession) {
                    localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY)
                }
                this.onLogout()
            }
            this.state.loading.pop()
        })

    }
    register(email, password) {
        return firebase
            .auth()
            .createUserWithEmailAndPassword(email, password)
            .then(newUser => {
                firebase
                    .database()
                    .ref(`/userProfile/${newUser.uid}/email`)
                    .set(email);
            })
            .catch(error => {
                console.error(error);
                throw new Error(error);
            });
    }
    login(email, password) {
        return this.firebase.auth().signInWithEmailAndPassword(email, password)
    }
    onLogin(user) {
        // Runs once we successfully logged in.
        console.warn('user logged in', user)
        this.state.user = user
        location.hash = ''
    }
    onLogout() {
        // This gets called when we log out.
        console.warn('user logged out')
        this.state.user = false
        location.hash = 'login'
    }

}