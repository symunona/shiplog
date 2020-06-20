


class State {

    constructor() {
        this.loading = []
        this.page = 'login'
        this.route = location.hash

        this.isMenuOpen = false

        this.user = false

        this.credentials = {
            email: '',
            password: ''
        }

        this.currentDay = false
        this.lastDayId = false

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


        // this = {
        //     loaded: true,
        //         loading: false,
        //             page: 'login',
        //                 route: location.hash,

        //                     credentials: {
        //         email: '',
        //             password: ''
        //     },
        //     // user: false,
        //     days: {
        //         '2016-03-15': {
        //             title: 'Búcsuzó nap',
        //                 tags: 'last days',
        //                     description: 'This was a fine day for good byes'
        //         },
        //         '2016-03-16': {
        //             title: 'A hátralévő életem első napja',
        //                 tags: 'first days',
        //                     description: 'Another fine day'
        //         }
        //     }
        // }
    }
}

export default new State()
