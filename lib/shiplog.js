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

const SEARCH_FIELDS = ['title', 'tags', 'description']

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
                prevDayId: getPrevDayId,
                prevDay(days) { return this.dayList[this.prevDayId(this.day.id, days || 1)] },
                getIndex(id) { return moment(id, ID_FORMAT).diff(moment(this.firstDayId, ID_FORMAT), 'days') },
                thisDayLastYears(id) {
                    var days = {}
                    let yearAgo = 0
                    let todayIndex = this.getIndex(id)
                    while (yearAgo * 365 < todayIndex) {
                        yearAgo++
                        let dayId = this.prevDayId(this.day.id, (yearAgo * 365) + 1)
                        if (this.dayList[dayId] && !isEmpty(this.dayList[dayId])) {
                            days[dayId] = this.dayList[dayId]
                            days[dayId].yearAgo = yearAgo
                        }
                    }
                    return days
                },
                goNextDay() { this.changeTheDay(this.nextDayId(this.day.id)) },
                goPrevDay() { this.changeTheDay(this.prevDayId(this.day.id)) }
            },
            watch: { day(day) { this.lastYearList = this.thisDayLastYears(day.id) } }
        }

        let DayListComponent = {
            props: ['day', 'dayList', 'lastDayId', 'changeTheDay', 'firstDayId'],
            data: ()=>{
                return {
                    filteredDayList: false,
                    todayId: moment().format(ID_FORMAT),
                    filter: ''
                }
            },
            methods: {
                isEmpty: isEmpty,
                focusInput() { this.$refs.filter.focus() },
                isDividerVisible(id){
                    let dataSetToLookIn = this.filteredDayList || this.dayList
                    let dayIndex = Object.keys(dataSetToLookIn).indexOf(id)
                    if (dayIndex > 0){
                        let formerDayId = Object.keys(dataSetToLookIn)[dayIndex - 1]
                        // Check if it's a different month or year
                        return formerDayId.substr(0, 7) !== id.substr(0, 7)
                    }
                    return false
                },
                yearMonth(id){ return moment(id, ID_FORMAT).format('YYYY MMMM') },

                scrollTop() { this.$parent.$refs['scrolling-container'].scrollTop = 0 },
                scrollBottom() { this.$parent.$refs['scrolling-container'].scrollTop = this.$parent.$refs['scrolling-container'].scrollHeight },

            },
            watch: {
                filter: {
                    handler: _.debounce((filter)=>{
                        if (filter.length > 1){
                            let found = {};
                            filter = filter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
                            Object.keys(this.vue.data.days).map((id)=>{
                                if (SEARCH_FIELDS.find((field)=>
                                    matches(this.vue.data.days[id][field], filter))
                                ){
                                    found[id] = this.vue.data.days[id]
                                }
                            })
                            this.state.filteredDayList = found
                        } else {
                            this.state.filteredDayList = false
                        }
                    }, 1000)
                }

            }
        }

        let ExportComponent = {
            props: ['dayList', 'user'],
            create(){}
        }


        let StatsComponent = {
            props: ['dayList', 'user'],
            data: ()=>{
                let tagListRaw = {}
                Object.keys(this.state.dayList).map((id)=>{
                    if (this.state.dayList[id].tags){
                        (this.state.dayList[id].tags).split(',').map((tag)=>tag.trim()).map(getRootTag).map((tag)=>{
                            tagListRaw[tag] = tagListRaw[tag] || {count: 0, days: []}
                            tagListRaw[tag].count ++;
                            tagListRaw[tag].days.push(id)
                        })
                    }
                })
                Object.keys(tagListRaw).map((tag)=>tagListRaw[tag].intervals = getIntervals(tagListRaw[tag].days))
                let tagListOrdered = {}
                Object.keys(tagListRaw)
                    .sort((a, b)=>(tagListRaw[a].count < tagListRaw[b].count)?1:((tagListRaw[a].count > tagListRaw[b].count)?-1:0))
                    .map((tag)=>tagListOrdered[tag]=tagListRaw[tag])
                return {
                    tagList: tagListOrdered
                }
            }
        }

        this.vue = new Vue({
            el: '#app',
            data: state,
            components: { Editor: DayEditorComponent, List: DayListComponent, Export: ExportComponent, Stats: StatsComponent },
            created() {
                window.addEventListener('beforeunload', () => {
                    if (this.currentDay.id) {
                        firebaseStoreWrapper.saveTheDay(this.currentDay.id, this.currentDay)
                    }
                })
                // This is the simplest router I have written, ever.
                window.addEventListener('hashchange', this.route)

                this.page = location.hash.length ? location.hash.substr(1) : ''
                this.filter = ''

                if (state.user){
                    if (this.data.days){
                        this.hadFormerSession = true
                        this.dayList = this.calculateDayList()
                    }
                }
                setTimeout(this.route.bind(this, {newURL: location.hash}),1)
            },
            methods: {
                route(event) {
                    if (this.doNotNavigate) return
                    let newHash = ''
                    if (event.newURL.split('#').length > 1) {
                        newHash = event.newURL.split('#')[1]
                    }
                    if (!this.user) {
                        if (!newHash){ location.hash = 'login'; return; }
                        if (PAGES_UNAUTHED.indexOf(newHash) > -1) {
                            this.page = newHash
                        }
                    } else {
                        if ((newHash && newHash.length === ID_FORMAT.length) || newHash === 'today'
                            && moment(newHash, ID_FORMAT).isValid()) {
                            this.changeTheDay(newHash)
                        } else {
                            if (['export', 'stats'].indexOf(newHash) > -1){

                            }
                            else{
                                // Reset the day if not on any sub-page.
                                this.changeTheDay(false)
                            }
                        }

                    }
                },
                login(event) {
                    event.preventDefault()
                    if (!state.credentials.email || !state.credentials.password) {
                        return this.error = 'You need to provide your username and your password!'
                    }
                    auth.login(state.credentials.email, state.credentials.password)
                        .then(() => this.page = '')
                        .catch((error) => this.error = error)
                },
                logout() {
                    auth.logout()
                    this.hadFormerSession = false
                    // Erase local storage
                    firebaseStoreWrapper.erase()
                    this.isMenuOpen = false
                    this.dayList = []
                },
                register(event) {
                    event.preventDefault()
                    if (!state.credentials.email || !state.credentials.password) {
                        return this.error = 'You need to provide your username and your password!'
                    }
                    if (!this.validateEmail(state.credentials.email)) {
                        return this.error = 'Please provide a valid email address'
                    }
                    if (state.credentials.password !== state.credentials.passwordAgain) {
                        return this.error = 'The passwords do not match!'
                    }
                    if (state.credentials.password.length < 6) {
                        return this.error = 'Password has to be at least 6 characters!'
                    }
                    this.loading.push('registering')
                    auth.register(this.credentials.email, this.credentials.password)
                        .then(() => {
                            this.page = ''
                            this.loading.pop()
                        }).catch((error) => {
                            this.error = error
                            this.loading.pop()
                        })
                },

                sendPasswordReset(event) {
                    event.preventDefault()
                    auth.sendPasswordReset(this.credentials.email)
                    this.page = 'reset-sent'
                },
                getIndex(id) { return moment(id, ID_FORMAT).diff(moment(this.firstDayId, ID_FORMAT), 'days') },
                nextDayId(id) { return moment(id, ID_FORMAT).add(1, 'day').format(ID_FORMAT) },

                changeTheDay(id) {
                    this.doNotNavigate = true;
                    if (id) {
                        if (this.currentDay){
                            this.saveTheDay(this.currentDay.id, this.currentDay)
                        }
                        location.hash = id

                        this.currentDay = _.extend({}, this.dayList[id]) || { title: '', tags: '', description: '' }
                        this.currentDay.id = id

                        // Autofill tags if empty, increase counters.
                        if (this.currentDay.tags === ''){
                            let prevDayId = getPrevDayId(id, 1);
                            if (prevDayId && this.data.days[prevDayId] && this.data.days[prevDayId].tags){
                                let tags = this.data.days[prevDayId].tags
                                let newTags = []
                                tags.split(',').map((tag)=>tag.trim()).map((tag)=>{
                                    if(tag.split(' ').length > 1){
                                        let tagParts = tag.split(' ')
                                        // Check if the last part is a number
                                        if (!isNaN(parseInt(tagParts[tagParts.length - 1]))){
                                            let tagPart = tagParts.slice(0, tagParts.length-1).join(' ')
                                            newTags.push(tagPart + ' ' + (parseInt(tagParts[tagParts.length - 1])+1))
                                        }
                                    }
                                })
                                this.currentDay.tags = newTags.join(', ')
                            }
                        }

                        // Autoresize
                        setTimeout(() => {
                            let textarea = document.getElementById('day-description')
                            if (!textarea) return;
                            textarea.style.height = ""
                            textarea.style.height = textarea.scrollHeight + "px"
                        }, 1)
                    }
                    else this.currentDay = false;
                    this.doNotNavigate = false;

                },
                saveTheDay(dayId, dayChanged) {
                    firebaseStoreWrapper.saveTheDay(dayId, dayChanged)
                },
                calculateDayList() {
                    // From day 0 to today
                    let lastDayId = this.tomorrowId
                    if (this.data && this.data.days && Object.keys(this.data.days).length) {
                        lastDayId = Object.keys(this.data.days).sort()[Object.keys(this.data.days).length - 1]
                        if (lastDayId < this.tomorrowId) lastDayId = this.tomorrowId
                    }
                    let newDayList = {}
                    let i = 0 // sanity check, not to run to infinite in case of bad data
                    let max = this.getIndex(this.tomorrowId) + 1000 // max 3 years up

                    // Fill missing days
                    for (let id = this.firstDayId; id <= lastDayId && i < max; id = this.nextDayId(id), i++) {
                        if (this.data && this.data.days && this.data.days[id]) {
                            newDayList[id] = this.data.days[id]
                        } else {
                            newDayList[id] = { title: '', tags: '', description: '' }
                        }
                    }
                    return newDayList
                },
                validateEmail(email) {
                    var re = /\S+@\S+\.\S+/;
                    return re.test(email);
                },
                back() {
                    location.hash = ''
                    setTimeout(()=>this.dayList = this.calculateDayList(),1)

                },
                // If scrolling is in place. See template: v-on:scroll.passive="handleScroll"
                handleScroll(ev){}

            },
            watch: {
                // When we change this ourselves do not navigate. If the user changes, e.g. back button, do so.
                page(newPage) {
                    this.doNotNavigate = true
                    location.hash = newPage?newPage:''
                    this.doNotNavigate = false
                    this.isMenuOpen = false
                },

                user(user, lastUser) {
                    if (!user) {
                        if (PAGES_UNAUTHED.indexOf(this.page) === -1) {
                            location.hash = 'login'
                        }
                    }
                    else {
                        this.loading.push('getting data')
                        firebaseStoreWrapper.init(user).then((data) => {
                            this.loading.pop()
                            if (!this.hadFormerSession){
                                this.dayList = this.calculateDayList()
                                this.route({ newURL: location.href })
                            }
                        })
                    }
                },
                currentDay: {
                    handler(currentDay, lastDay) {
                        this.dayOfWeek = moment(currentDay.id, ID_FORMAT).format('dddd')
                        let dayToSave = lastDay
                        if (dayToSave && !isEmpty(dayToSave)) {
                            this.saveTheDay(dayToSave.id, dayToSave)
                        } else {
                            this.dayList = this.calculateDayList()
                            this.lastDayId = currentDay.id
                        }
                    },
                    deep: true
                },

            },
            computed: {
                firstDayId() {
                    if (this.data && this.data.days && Object.keys(this.data.days).length) {
                        return Object.keys(this.data.days)[0]
                    }
                    return this.todayId
                },
                backButtonVisible(){
                    return this.currentDay || (this.page && this.page !== 'login')
                }
            },
            updated() {
                this.$nextTick(() => {
                    // Code that will run only after the
                    // entire view has been re-rendered
                    this.scrollContainerElement = document.getElementById('scrolling-container')

                    if (this.lastDayId) {
                        let element = document.getElementById(this.lastDayId)
                        element.scrollIntoView()
                        element.classList.add('highlight')
                        setTimeout(() => element.classList.remove('highlight'), 3000)
                    } else {
                        this.scrollContainerElement.scrollTop = this.scrollContainerElement.scrollHeight
                    }
                })
            },

        })
        function getPrevDayId(id, dif) { return moment(id, ID_FORMAT).add(-dif || -1, 'day').format(ID_FORMAT) }
    }
}


function getIntervals(days){
    if (!days || !days.length) { return; }
    days = days.sort()
    let intervalStart = days[0]
    let intervals = []
    for(let i = 1; i<days.length; i++){
        let prevDayId = moment(days[i], ID_FORMAT).add(-1, 'day').format(ID_FORMAT)
        if (prevDayId !== days[i-1]){
            intervals.push({
                start: intervalStart,
                end: days[i-1],
                expand: false,
                diff: moment(days[i-1]).diff(moment(intervalStart, ID_FORMAT),'days')
            })
            intervalStart = days[i]
        }
    }
    return intervals
}

/**
 * @param {Object} day
 * @returns {Boolean} true, if day has no saved content yet.
 */
function isEmpty(day){
    return !day || !day.title && !day.description && !day.tags
}

/**
 * Cuts the number of the end of the tag if present.
 * @param {String} tag
 * @returns {String}
 */
function getRootTag(tag){
    let tagParts = tag.split(' ')
    // Check if the last part is a number
    if (!isNaN(parseInt(tagParts[tagParts.length - 1]))){
        let tagPart = tagParts.slice(0, tagParts.length-1).join(' ')
        return tagPart.trim();
    }
    // The number is concatenated to the string
    let found = tag.match(/\.*[0-9]+/)
    if (found){
        return tag.substr(0, found.index).trim();
    }
    return tag;
}

/**
 * This function normalizes special characters, e.g. áéőüűöőúó into their accent-free counterpart,
 * plust it matches everything lowercase.
 * @param {String} stringToSearchIn
 * @param {*} filter
 */
function matches(stringToSearchIn, filter){
    if (stringToSearchIn && stringToSearchIn.length){
        return stringToSearchIn.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().indexOf(filter) > -1
    }
    return false;
}

window.app = new Shiplog()