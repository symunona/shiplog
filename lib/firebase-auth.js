
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
    }
    login(email, password) {
        return this.firebase.auth().signInWithEmailAndPassword(email, password)
    }
    logout() {
        this.firebase.auth().signOut()
    }

    sendPasswordReset(email){
        this.firebase.auth().sendPasswordResetEmail(email)
    }

    onLogin(user) {
        // Runs once we successfully logged in.
        this.state.user = user
    }
    onLogout() {
        // This gets called when we log out.
        this.state.user = false
    }

}