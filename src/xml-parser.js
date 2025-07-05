// XML parser module stub
export function getXMLParser() {
    return {
        default: {
            parse: (xmlString) => {
                try {
                    // Simple XML parsing stub - returns mock object
                    return {
                        "Window Settings": {
                            "Basic": {
                                Bell: false
                            }
                        }
                    };
                } catch (error) {
                    console.error('XML parsing error:', error);
                    return {};
                }
            }
        }
    };
}