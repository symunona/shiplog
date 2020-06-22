'use strict'
/**
 * Shiplog
 *
 * ... for any type of water.
 */

import Vue from '../node_modules/vue/dist/vue.esm.browser.js'

import FirebaseAuth from './firebase-auth.js'

import FIREBASE_CONFIG from './firebase-credentials.js'

import state from './state.js'

import FirebaseDbWrapper from './firebase-db-wrapper.js'

// import moment from '../node_modules/moment/src/moment.js'

import * as _ from '../node_modules/underscore/modules/index-all.js'

const ID_FORMAT = 'YYYY-MM-DD'

const AUTO_SAVE = 5000

const PAGES_UNAUTHED = ['login', 'register', 'forgot']

class Shiplog {
    constructor() {
        // Initialize firebase config.
        this.firebase = firebase.initializeApp(FIREBASE_CONFIG)

        this.state = state

        // Try authenticate the user.
        let auth = new FirebaseAuth(firebase, state)
        let firebaseStoreWrapper = new FirebaseDbWrapper(this.firebase, this.state)

        state.page = state.user ? 'home' : 'login'
        state.todayId = moment().format(ID_FORMAT)
        state.tomorrowId = moment().add(1, 'day').format(ID_FORMAT)

        let DayEditorComponent = {
            props: ['day', 'dayList', 'firstDayId', 'changeTheDay'],
            created() {
                this.lastYearList = this.thisDayLastYears(this.day.id)
            },
            methods: {
                nextDayId(id) { return moment(id, ID_FORMAT).add(1, 'day').format(ID_FORMAT) },
                prevDayId(id, dif) { return moment(id, ID_FORMAT).add(-dif || -1, 'day').format(ID_FORMAT) },
                prevDay(days) { return this.dayList[this.prevDayId(this.day.id, days || 1)] },
                getIndex(id) { return moment(id, ID_FORMAT).diff(moment(this.firstDayId, ID_FORMAT), 'days') },
                thisDayLastYears(id) {
                    var days = {}
                    let yearAgo = 0
                    let todayIndex = this.getIndex(id)
                    while (yearAgo * 365 < todayIndex) {
                        yearAgo++
                        let dayId = this.prevDayId(this.day.id, yearAgo * 365)
                        if (this.dayList[dayId] && !this.dayList[dayId].empty) {
                            days[dayId] = this.dayList[dayId]
                            days[dayId].yearAgo = yearAgo
                        }
                    }
                    return days
                },
                goNextDay() { this.changeTheDay(this.nextDayId(this.day.id)) },
                goPrevDay() { this.changeTheDay(this.prevDayId(this.day.id)) }
            }
        }

        this.vue = new Vue({
            el: '#app',
            data: state,
            components: { Editor: DayEditorComponent },
            created() {
                document.addEventListener('beforeunload', () => {
                    if (this.currentDay.id) {
                        firebaseStoreWrapper.saveTheDay(this.currentDay.id, this.currentDay)
                    }
                })
                console.warn('regging hashchange')
                // This is the simplest router I have written, ever.
                window.addEventListener('hashchange', this.route)

                this.route({ newURL: location.href })
            },
            methods: {
                route(event) {
                    if (this.doNotNavigate) return
                    let newHash = ''
                    if (event.newURL.split('#').length > 1) {
                        newHash = event.newURL.split('#')[1]
                    }
                    console.error(newHash)
                    if (!this.user) {
                        if (PAGES_UNAUTHED.indexOf(newHash) > -1) {
                            this.page = newHash
                        }
                    } else {

                    }
                },
                login() {
                    auth.login(state.credentials.email, state.credentials.password)
                        .then(() => this.page = '')
                        .catch((error) => this.error = error)
                },
                logout() {
                    auth.logout()
                    // Erase local storage
                    firebaseStoreWrapper.erase()
                    this.isMenuOpen = false
                    this.dayList = []
                },
                register() {
                    auth.register(this.credentials.email, this.credentials.password)
                        .then(() => this.page = '')
                        .catch((error) => this.error = error)

                },
                sendPasswordReset() {
                    auth.sendPasswordReset(this.credentials.email)
                    this.page = 'reset-sent'
                },
                getIndex(id) { return moment(id, ID_FORMAT).diff(moment(this.firstDayId, ID_FORMAT), 'days') },
                nextDayId(id) { return moment(id, ID_FORMAT).add(1, 'day').format(ID_FORMAT) },
                changeTheDay(id) {
                    this.dayList[id].id = id
                    this.currentDay = this.dayList[id] || { title: '', tags: '', description: '', id }
                },
                scrollTop() { this.scrollContainerElement.scrollTop = 0 },
                scrollBottom() { this.scrollContainerElement.scrollTop = this.scrollContainerElement.scrollHeight },
                saveTheDay: _.throttle(function (dayId, dayChanged) {
                    firebaseStoreWrapper.saveTheDay(dayId, dayChanged)
                }, AUTO_SAVE),
                calculateDayList() {
                    // From day 0 to today
                    let missingDays = []
                    let newDayList = {}

                    // Fill missing days
                    for (let id = this.firstDayId; id != this.tomorrowId; id = this.nextDayId(id)) {
                        if (this.data && this.data.days && this.data.days[id]) {
                            newDayList[id] = this.data.days[id]
                        } else {
                            newDayList[id] = { title: '', tags: '', description: '', empty: true }
                            missingDays.push(id)
                        }
                    }
                    return newDayList
                }
            },
            watch: {
                // route() {
                //     state.page = window.location.hash.substr(1) // the first day
                // },

                // When we change this ourselves do not navigate. If the user changes, e.g. back button, do so.
                page(newPage) {
                    this.doNotNavigate = true
                    location.hash = newPage
                    this.doNotNavigate = false
                },

                user(user, lastUser) {
                    if (!user) {
                        console.warn('state.page', this.page)
                        if (PAGES_UNAUTHED.indexOf(this.page) === -1) {
                            this.page = 'login'
                        }
                    }
                    else {
                        this.loading.push('getting data')
                        firebaseStoreWrapper.init(user).then((data) => {
                            this.dayList = this.calculateDayList()
                            this.loading.pop()
                        })
                    }
                },
                currentDay: {
                    handler(currentDay, lastCurrentDay) {
                        this.lastDayId = currentDay.id
                        this.dayOfWeek = moment(currentDay.id, ID_FORMAT).format('dddd')

                        let dayToSave = lastCurrentDay || currentDay
                        if (dayToSave) {
                            // This handles if there is actually anything to be saved.
                            let dayToSaveRaw = _.clone(dayToSave)
                            delete dayToSaveRaw.id
                            delete dayToSaveRaw.empty
                            this.saveTheDay(currentDay.id, dayToSaveRaw)
                        } else {
                            this.dayList = this.calculateDayList()
                        }
                    },
                    deep: true
                }
            },
            computed: {
                firstDayId() {
                    if (this.data && this.data.days && Object.keys(this.data.days).length) {
                        return Object.keys(this.data.days)[0]
                    }
                    return this.todayId
                }
            },
            updated() {
                this.$nextTick(() => {
                    // Code that will run only after the
                    // entire view has been re-rendered
                    this.scrollContainerElement = document.getElementById('scrolling-container')
                    if (this.currentDay) {
                        this.scrollContainerElement.scrollTop = 0
                    } else {
                        if (this.lastDayId) {
                            document.getElementById(this.lastDayId).scrollIntoView();
                        } else {
                            this.scrollContainerElement.scrollTop = this.scrollContainerElement.scrollHeight
                        }
                    }
                })
            }
        })
    }
}

window.app = new Shiplog()