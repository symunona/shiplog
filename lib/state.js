


class State {

    constructor() {
        this.loading = []
        this.page = ''

        this.isMenuOpen = false

        this.user = false

        this.credentials = {
            email: '',
            password: '',
            passwordAgain: ''
        }

        this.error = false

        this.currentDay = false
        this.lastDayId = false
        this.dayList = []
        this.filteredDayList = false

        // When we change this ourselves do not navigate. If the user changes, e.g. back button, do so.
        this.doNotNavigate = false

        this.filter = ''

        this.whereAmI = 'now'

        this.hadFormerSession = false

        this.data = {
            days: {
                '2016-03-15': {
                    title: 'Búcsuzó nap',
                    tags: 'last days',
                    description: 'This was a fine day for good byes'
                },
                '2016-03-16': {
                    title: 'A hátralévő életem első napja',
                    tags: 'first days',
                    description: 'Another fine day'
                }
            }
        }
    }
}

export default new State()
