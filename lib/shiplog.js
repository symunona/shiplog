'use strict'
/**
 * Shiplog
 *
 * ... for any type of water.
 */

import Vue from '../node_modules/vue/dist/vue.esm.browser.js'

import FirebaseAuth from './firebase-auth'

import FIREBASE_CONFIG from './firebase-credentials'

import state from './state'

import FirebaseDbWrapper from './firebase-db-wrapper'

class Shiplog {
    constructor() {
        // Initialize firebase config.
        this.firebase = firebase.initializeApp(FIREBASE_CONFIG)

        this.state = state

        // Try authenticate the user.
        let auth = new FirebaseAuth(firebase, state)
        let renderStart = new Date()
        let firebaseStoreWrapper = new FirebaseDbWrapper(this.firebase, this.state)

        state.page = state.user ? 'home' : 'login'

        this.vue = new Vue({
            el: '#app',
            data: state,
            methods: {
                login() {
                    auth.login(state.credentials.email, state.credentials.password)
                }
            },
            watch: {
                route() {
                    state.page = window.location.hash.substr(1)
                },

                user(user, lastUser) {
                    console.log('user', user)

                    if (!user) {
                        state.page = 'login'
                    } else {

                        firebaseStoreWrapper.init(user)

                    }
                }
            }
        })

        console.log('render time', new Date() - renderStart)
    }
}

window.app = new Shiplog()