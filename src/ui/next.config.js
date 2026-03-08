/** @type {import('next').NextConfig} */
module.exports = {
    output: "standalone",
    logging: true,
    async redirects() {
        return [
            {
                source: '/',
                destination: '/nettools',
                permanent: true,
            },
        ]
    },
};